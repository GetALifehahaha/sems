import websocket
import json
import csv
import os

# ==========================================
# ⚙️ SETTINGS
# ==========================================
# Double check this matches your Ngrok or Local IP!
WS_URL = "ws://10.80.204.223:8000/ws/electrical/"
CSV_FILENAME = "my_appliances_dataset.csv"

previous_power = 0.0
previous_current = 0.0

def setup_csv():
    file_exists = os.path.isfile(CSV_FILENAME)
    with open(CSV_FILENAME, mode='a', newline='') as file:
        writer = csv.writer(file)
        if not file_exists or os.stat(CSV_FILENAME).st_size == 0:
            writer.writerow(["Power_Jump_Watts", "Current_Jump_Amps", "Appliance_Name"])
    print(f"📄 Dataset file ready: {CSV_FILENAME}")

def on_message(ws, message):
    global previous_power, previous_current
    
    # 📝 HEARTBEAT: This tells us the connection is alive!
    print(f"📡 Received Data: {message}")
    
    try:
        data = json.loads(message)
        current_power = float(data.get("power", 0))
        current_amps = float(data.get("current", 0))
        
        # Calculate the jump
        power_jump = current_power - previous_power
        current_jump = current_amps - previous_current
        
        # Update memory for next time
        previous_power = current_power
        previous_current = current_amps
        
        # Check for spike (> 3 Watts)
        if power_jump > 3:
            print(f"\n⚡ SPIKE DETECTED! Jumped by {power_jump:.2f}W")
            appliance_name = input("❓ What did you just turn on? (Type name or 'Skip'): ")
            
            if appliance_name.lower() != 'skip':
                with open(CSV_FILENAME, mode='a', newline='') as file:
                    writer = csv.writer(file)
                    writer.writerow([power_jump, current_jump, appliance_name])
                print(f"✅ Saved to CSV!")
    except Exception as e:
        print(f"❌ Error parsing JSON: {e}")

def on_error(ws, error):
    print(f"🔴 Connection Error: {error}")

def on_close(ws, close_status_code, close_msg):
    print("⚪ Connection Closed. Retrying in 3 seconds...")

def on_open(ws):
    print("🟢 SUCCESS: Connected to WebSocket! Watching for data...")

if __name__ == "__main__":
    setup_csv()
    # Adding a header to bypass Ngrok browser warnings
    ws = websocket.WebSocketApp(
        WS_URL, 
        on_open=on_open, 
        on_message=on_message, 
        on_error=on_error, 
        on_close=on_close,
        header={"ngrok-skip-browser-warning": "69420"}
    )
    ws.run_forever()