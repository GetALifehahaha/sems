import joblib
import os
import pandas as pd

class AppliancePredictor:
    def __init__(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Point to the .joblib file we created in Step 3
        model_path = os.path.join(current_dir, '..', 'ml_pipeline', 'appliance_model.joblib')
        
        try:
            self.model = joblib.load(model_path)
            self.is_ready = True
            print("🟢 ML Model Loaded Successfully!")
        except Exception as e:
            print(f"🔴 Failed to load ML Model: {e}")
            self.is_ready = False

    def predict(self, power_jump, current_jump):
        if not self.is_ready:
            return None
            
        input_data = pd.DataFrame(
            [[power_jump, current_jump]], 
            columns=['Power_Jump_Watts', 'Current_Jump_Amps']
        )
        
        prediction = self.model.predict(input_data)
        return prediction[0] 

appliance_ai = AppliancePredictor()