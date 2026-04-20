import pandas as pd
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

def train_and_save_model():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(current_dir, 'my_appliances_dataset.csv')
    
    if not os.path.exists(csv_path):
        print(f"❌ Could not find {csv_path}. Did you run collect_data.py first?")
        return

    print("📊 Loading and cleaning dataset...")
    df = pd.read_csv(csv_path)
    
    # 🧹 THE FIX: Clean the data
    # 1. Drop any rows that are missing data (NaN)
    df = df.dropna()
    # 2. Force the Appliance_Name to be a string (word), not a number
    df['Appliance_Name'] = df['Appliance_Name'].astype(str)
    # 3. Remove any rows where the name is just empty text
    df = df[df['Appliance_Name'].str.strip() != ""]

    if len(df) < 5:
        print(f"❌ After cleaning, you only have {len(df)} rows. You need at least 5 to train!")
        return

    # X is what the AI sees (Jumps). y is what the AI guesses (Appliance Name).
    X = df[['Power_Jump_Watts', 'Current_Jump_Amps']]
    y = df['Appliance_Name']
    
    # We split 80% for training and 20% for testing
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"🧠 Training Random Forest Model on {len(X_train)} samples...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Take the test
    predictions = model.predict(X_test)
    acc = accuracy_score(y_test, predictions)
    print(f"✅ Model Accuracy: {acc * 100:.2f}%")
    
    save_path = os.path.join(current_dir, 'appliance_model.joblib')
    joblib.dump(model, save_path)
    print(f"💾 AI Brain saved to: {save_path}")

if __name__ == "__main__":
    train_and_save_model()