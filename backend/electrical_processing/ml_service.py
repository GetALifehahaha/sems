import joblib
import os
import pandas as pd


FEATURE_COLUMNS = ["Power_Jump_Watts", "Current_Jump_Amps"]
DEFAULT_CONFIDENCE_THRESHOLD = 0.5

class AppliancePredictor:
    def __init__(self):
        self.is_ready = False
        self.model = None
        self.confidence_threshold = DEFAULT_CONFIDENCE_THRESHOLD

        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Point to the .joblib file we created in Step 3
        self.model_path = os.path.join(current_dir, '..', 'ml_pipeline', 'appliance_model.joblib')
        self.reload_model()

    def reload_model(self):
        try:
            self.model = joblib.load(self.model_path)
            self.is_ready = True
            print("🟢 ML Model Loaded Successfully!")
            return True
        except Exception as e:
            print(f"🔴 Failed to load ML Model: {e}")
            self.model = None
            self.is_ready = False
            return False

    def _build_input_frame(self, power_jump, current_jump):
        return pd.DataFrame(
            [[power_jump, current_jump]],
            columns=FEATURE_COLUMNS
        )

    def predict(self, power_jump, current_jump):
        prediction = self.predict_with_confidence(power_jump, current_jump)
        return prediction["label"]

    def predict_with_confidence(self, power_jump, current_jump, top_k=3):
        if not self.is_ready or self.model is None:
            return {
                "label": None,
                "confidence": 0.0,
                "top_candidates": [],
            }

        input_data = self._build_input_frame(power_jump, current_jump)
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

    def predict_label_with_threshold(self, power_jump, current_jump, threshold=None):
        prediction = self.predict_with_confidence(power_jump, current_jump)
        if prediction["label"] is None:
            return None

        min_confidence = self.confidence_threshold if threshold is None else float(threshold)
        if prediction["confidence"] < min_confidence:
            return "Unknown"

        return prediction["label"]

appliance_ai = AppliancePredictor()