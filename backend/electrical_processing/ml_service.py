import joblib
import json
import os
import pandas as pd


DEFAULT_FEATURE_COLUMNS = [
    "Power_Jump_Abs_Watts",
    "Current_Jump_Abs_Amps",
    "Event_Type_Code",
    "Power_Current_Ratio",
]
LEGACY_FEATURE_COLUMNS = ["Power_Jump_Watts", "Current_Jump_Amps"]
DEFAULT_CONFIDENCE_THRESHOLD = 0.5


class AppliancePredictor:
    def __init__(self):
        self.is_ready = False
        self.model = None
        self.feature_columns = list(DEFAULT_FEATURE_COLUMNS)
        self.model_metadata = {}
        self.confidence_threshold = DEFAULT_CONFIDENCE_THRESHOLD
        self.catalog = {}

        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Point to the .joblib file we created in Step 3
        self.model_path = os.path.join(current_dir, '..', 'ml_pipeline', 'appliance_model.joblib')
        self.catalog_path = os.path.join(current_dir, '..', 'ml_pipeline', 'appliance_catalog.json')
        self.reload_model()

    def _load_catalog(self):
        try:
            with open(self.catalog_path, "r", encoding="utf-8") as catalog_file:
                payload = json.load(catalog_file)

            appliances = payload.get("appliances", [])
            self.catalog = {
                str(entry.get("label", "")).strip().lower(): entry
                for entry in appliances
                if str(entry.get("label", "")).strip()
            }
        except OSError:
            self.catalog = {}
        except json.JSONDecodeError:
            self.catalog = {}

    def _normalize_event_type(self, event_type):
        normalized = str(event_type or "ON").strip().upper()
        return normalized if normalized in {"ON", "OFF"} else "ON"

    def _feature_value_map(self, power_jump, current_jump, event_type):
        power_abs = abs(float(power_jump))
        current_abs = abs(float(current_jump))
        ratio = power_abs / max(current_abs, 0.01)
        event_code = 1.0 if self._normalize_event_type(event_type) == "ON" else 0.0

        return {
            "Power_Jump_Watts": power_abs,
            "Current_Jump_Amps": current_abs,
            "Power_Jump_Abs_Watts": power_abs,
            "Current_Jump_Abs_Amps": current_abs,
            "Event_Type_Code": event_code,
            "Power_Current_Ratio": min(max(ratio, 0.0), 2500.0),
        }

    def _apply_catalog_penalties(self, ranked_candidates, power_jump):
        power_abs = abs(float(power_jump))
        adjusted = []

        for label, probability in ranked_candidates:
            label_text = str(label)
            probability_value = float(probability)
            metadata = self.catalog.get(label_text.strip().lower())

            if metadata:
                min_power = float(metadata.get("power_on_min", 0.0))
                max_power = float(metadata.get("power_on_max", min_power + 1.0))

                if power_abs < (min_power * 0.7) or power_abs > (max_power * 1.3):
                    probability_value *= 0.35
                elif power_abs < min_power or power_abs > max_power:
                    probability_value *= 0.72

            adjusted.append((label_text, probability_value))

        total = sum(probability for _, probability in adjusted)
        if total > 0:
            adjusted = [(label, probability / total) for label, probability in adjusted]

        adjusted.sort(key=lambda pair: pair[1], reverse=True)
        return adjusted

    def reload_model(self):
        try:
            model_payload = joblib.load(self.model_path)

            if isinstance(model_payload, dict) and "model" in model_payload:
                self.model = model_payload["model"]
                loaded_features = model_payload.get("feature_columns")
                if isinstance(loaded_features, list) and loaded_features:
                    self.feature_columns = [str(column) for column in loaded_features]
                else:
                    self.feature_columns = list(DEFAULT_FEATURE_COLUMNS)
                self.model_metadata = model_payload.get("metadata", {})
            else:
                self.model = model_payload
                self.feature_columns = list(LEGACY_FEATURE_COLUMNS)
                self.model_metadata = {}

            self._load_catalog()
            self.is_ready = True
            print("🟢 ML Model Loaded Successfully!")
            return True
        except Exception as e:
            print(f"🔴 Failed to load ML Model: {e}")
            self.model = None
            self.feature_columns = list(DEFAULT_FEATURE_COLUMNS)
            self.model_metadata = {}
            self.catalog = {}
            self.is_ready = False
            return False

    def _build_input_frame(self, power_jump, current_jump, event_type="ON"):
        value_map = self._feature_value_map(power_jump, current_jump, event_type)
        ordered_values = [value_map.get(column, 0.0) for column in self.feature_columns]

        return pd.DataFrame(
            [ordered_values],
            columns=self.feature_columns
        )

    def predict(self, power_jump, current_jump, event_type="ON"):
        prediction = self.predict_with_confidence(power_jump, current_jump, event_type=event_type)
        return prediction["label"]

    def predict_with_confidence(self, power_jump, current_jump, event_type="ON", top_k=3):
        if not self.is_ready or self.model is None:
            return {
                "label": None,
                "confidence": 0.0,
                "top_candidates": [],
            }

        input_data = self._build_input_frame(power_jump, current_jump, event_type=event_type)
        raw_prediction = self.model.predict(input_data)
        label = str(raw_prediction[0]) if len(raw_prediction) else None

        result = {
            "label": label,
            "confidence": 1.0 if label else 0.0,
            "top_candidates": [],
        }

        if not hasattr(self.model, "predict_proba"):
            return result

        probabilities = self.model.predict_proba(input_data)[0]
        classes = self.model.classes_
        ranked = sorted(
            zip(classes, probabilities),
            key=lambda pair: pair[1],
            reverse=True,
        )

        ranked = self._apply_catalog_penalties(ranked, power_jump)

        top_k = max(1, min(int(top_k), len(ranked)))
        result["top_candidates"] = [
            {
                "label": str(candidate_label),
                "confidence": float(candidate_confidence),
            }
            for candidate_label, candidate_confidence in ranked[:top_k]
        ]

        if ranked:
            result["label"] = str(ranked[0][0])
            result["confidence"] = float(ranked[0][1])

        return result

    def predict_label_with_threshold(self, power_jump, current_jump, threshold=None, event_type="ON"):
        prediction = self.predict_with_confidence(power_jump, current_jump, event_type=event_type)
        if prediction["label"] is None:
            return None

        min_confidence = self.confidence_threshold if threshold is None else float(threshold)
        if prediction["confidence"] < min_confidence:
            return "Unknown"

        return prediction["label"]

appliance_ai = AppliancePredictor()