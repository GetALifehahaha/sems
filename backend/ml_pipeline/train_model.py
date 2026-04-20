import json
import os
from datetime import datetime, timezone

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split


POWER_COLUMN = "Power_Jump_Watts"
CURRENT_COLUMN = "Current_Jump_Amps"
EVENT_COLUMN = "Event_Type"
SOURCE_COLUMN = "Source"
TARGET_COLUMN = "Appliance_Name"
FEATURE_COLUMNS = [
    "Power_Jump_Abs_Watts",
    "Current_Jump_Abs_Amps",
    "Event_Type_Code",
    "Power_Current_Ratio",
]
MIN_TOTAL_ROWS = 16


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_event_type(raw_event, power_jump):
    event_value = str(raw_event or "").strip().upper()
    if event_value in {"ON", "OFF"}:
        return event_value
    return "OFF" if _to_float(power_jump) < 0 else "ON"


def _source_weight(source_name):
    source = str(source_name or "").strip().lower()
    if not source:
        return 1.0

    if "synthetic" in source:
        return 0.55
    if "feedback" in source:
        return 1.7
    if "collector" in source or "manual" in source:
        return 1.35
    if "user" in source:
        return 1.45
    return 1.0


def _clean_dataset(df):
    required_columns = [POWER_COLUMN, CURRENT_COLUMN, TARGET_COLUMN]
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")

    cleaned = df.copy()
    cleaned[POWER_COLUMN] = pd.to_numeric(cleaned[POWER_COLUMN], errors="coerce")
    cleaned[CURRENT_COLUMN] = pd.to_numeric(cleaned[CURRENT_COLUMN], errors="coerce")
    cleaned[TARGET_COLUMN] = cleaned[TARGET_COLUMN].astype(str).str.strip()

    if EVENT_COLUMN not in cleaned.columns:
        cleaned[EVENT_COLUMN] = ""
    if SOURCE_COLUMN not in cleaned.columns:
        cleaned[SOURCE_COLUMN] = "unknown"

    cleaned[EVENT_COLUMN] = cleaned.apply(
        lambda row: _normalize_event_type(row.get(EVENT_COLUMN, ""), row.get(POWER_COLUMN, 0.0)),
        axis=1,
    )
    cleaned[SOURCE_COLUMN] = cleaned[SOURCE_COLUMN].astype(str).str.strip().replace("", "unknown")

    cleaned = cleaned.dropna(subset=required_columns)
    cleaned = cleaned[cleaned[TARGET_COLUMN] != ""]
    cleaned = cleaned[cleaned[TARGET_COLUMN].str.lower() != "nan"]

    cleaned["Power_Jump_Abs_Watts"] = cleaned[POWER_COLUMN].abs()
    cleaned["Current_Jump_Abs_Amps"] = cleaned[CURRENT_COLUMN].abs()
    cleaned["Event_Type_Code"] = cleaned[EVENT_COLUMN].apply(lambda value: 1.0 if value == "ON" else 0.0)

    ratio_denominator = cleaned["Current_Jump_Abs_Amps"].replace(0, 0.01)
    cleaned["Power_Current_Ratio"] = (cleaned["Power_Jump_Abs_Watts"] / ratio_denominator).clip(lower=0.0, upper=2500.0)

    for feature_column in FEATURE_COLUMNS:
        cleaned[feature_column] = pd.to_numeric(cleaned[feature_column], errors="coerce")

    cleaned = cleaned.dropna(subset=FEATURE_COLUMNS)

    return cleaned


def _build_sample_weights(df):
    return df[SOURCE_COLUMN].apply(_source_weight).astype(float)


def _compute_top3_accuracy(model, x_test, y_test):
    if not hasattr(model, "predict_proba"):
        return None

    try:
        probabilities = model.predict_proba(x_test)
        classes = model.classes_
        if len(classes) == 0:
            return None

        top_k = 3 if len(classes) >= 3 else len(classes)
        correct = 0

        for row_probs, true_label in zip(probabilities, y_test):
            ranked = sorted(
                zip(classes, row_probs),
                key=lambda pair: pair[1],
                reverse=True,
            )
            top_candidates = [label for label, _ in ranked[:top_k]]
            if true_label in top_candidates:
                correct += 1

        return correct / len(y_test) if len(y_test) > 0 else None
    except Exception:
        return None


def train_and_save_model():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, "my_appliances_dataset.csv")

    if not os.path.exists(csv_path):
        print(f"❌ Could not find {csv_path}. Did you run collect_data.py first?")
        return

    print("📊 Loading and cleaning dataset...")
    raw_df = pd.read_csv(csv_path)

    try:
        df = _clean_dataset(raw_df)
    except ValueError as error:
        print(f"❌ {error}")
        return

    if len(df) < MIN_TOTAL_ROWS:
        print(
            f"❌ After cleaning, you only have {len(df)} rows. "
            f"You need at least {MIN_TOTAL_ROWS} to train a useful model."
        )
        return

    x = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN]
    sample_weights = _build_sample_weights(df)

    class_counts = y.value_counts()
    if len(class_counts) < 2:
        print("❌ Need at least 2 appliance classes to train NILP classification.")
        return

    stratify_target = y if class_counts.min() >= 2 else None
    if stratify_target is None:
        print("⚠️ Some classes have fewer than 2 samples. Training without stratification.")

    indices = list(df.index)
    train_idx, test_idx = train_test_split(
        indices,
        test_size=0.2,
        random_state=42,
        stratify=stratify_target,
    )

    x_train = x.loc[train_idx]
    x_test = x.loc[test_idx]
    y_train = y.loc[train_idx]
    y_test = y.loc[test_idx]
    w_train = sample_weights.loc[train_idx]

    print(f"🧠 Training RandomForest on {len(x_train)} samples...")
    model = RandomForestClassifier(
        n_estimators=500,
        random_state=42,
        class_weight="balanced_subsample",
        n_jobs=-1,
    )
    model.fit(x_train, y_train, sample_weight=w_train)

    predictions = model.predict(x_test)

    accuracy = accuracy_score(y_test, predictions)
    balanced_accuracy = balanced_accuracy_score(y_test, predictions)
    macro_f1 = f1_score(y_test, predictions, average="macro", zero_division=0)
    top3_accuracy = _compute_top3_accuracy(model, x_test, y_test)

    report_dict = classification_report(y_test, predictions, output_dict=True, zero_division=0)
    per_class_report = {
        str(label): {
            "precision": float(metrics.get("precision", 0.0)),
            "recall": float(metrics.get("recall", 0.0)),
            "f1_score": float(metrics.get("f1-score", 0.0)),
            "support": int(metrics.get("support", 0)),
        }
        for label, metrics in report_dict.items()
        if label not in {"accuracy", "macro avg", "weighted avg"}
    }

    model_path = os.path.join(current_dir, "appliance_model.joblib")
    model_bundle = {
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "metadata": {
            "version": "schema_v3",
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "event_mapping": {"ON": 1.0, "OFF": 0.0},
            "source_weighting": {
                "synthetic": 0.55,
                "feedback": 1.7,
                "user": 1.45,
                "collector": 1.35,
            },
        },
    }
    joblib.dump(model_bundle, model_path)

    source_distribution = {
        str(label): int(count)
        for label, count in df[SOURCE_COLUMN].value_counts().items()
    }

    model_report = {
        "model_path": model_path,
        "training": {
            "rows_total": int(len(raw_df)),
            "rows_after_cleaning": int(len(df)),
            "train_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
            "class_distribution": {str(label): int(count) for label, count in class_counts.items()},
            "features": FEATURE_COLUMNS,
            "event_distribution": {
                str(label): int(count)
                for label, count in df[EVENT_COLUMN].value_counts().items()
            },
            "source_distribution": source_distribution,
        },
        "metrics": {
            "accuracy": float(accuracy),
            "balanced_accuracy": float(balanced_accuracy),
            "macro_f1": float(macro_f1),
            "top3_accuracy": None if top3_accuracy is None else float(top3_accuracy),
        },
        "per_class": per_class_report,
    }

    report_path = os.path.join(current_dir, "appliance_model_report.json")
    with open(report_path, "w", encoding="utf-8") as report_file:
        json.dump(model_report, report_file, indent=2)

    print(f"✅ Accuracy: {accuracy * 100:.2f}%")
    print(f"✅ Balanced Accuracy: {balanced_accuracy * 100:.2f}%")
    print(f"✅ Macro F1: {macro_f1:.4f}")
    if top3_accuracy is not None:
        print(f"✅ Top-3 Accuracy: {top3_accuracy * 100:.2f}%")
    print(f"💾 Model saved: {model_path}")
    print(f"📄 Report saved: {report_path}")

if __name__ == "__main__":
    train_and_save_model()