import websocket
import json
import csv
import os
import time
import argparse
from urllib.parse import urlparse, urlunparse

# ==========================================
# ⚙️ SETTINGS
# ==========================================
DEFAULT_WS_PATH = "/ws/electrical/"
DEFAULT_WS_URL = f"ws://127.0.0.1:8000{DEFAULT_WS_PATH}"
DEFAULT_RETRY_DELAY_SECONDS = 3

WS_URL = os.getenv("WS_URL", DEFAULT_WS_URL)
CSV_FILENAME = os.getenv("NILP_DATASET_CSV", "my_appliances_dataset.csv")
SPIKE_THRESHOLD_WATTS = float(os.getenv("SPIKE_THRESHOLD_WATTS", "3"))

previous_power = 0.0
previous_current = 0.0


def normalize_ws_url(raw_url):
    """Accept ws/wss/http/https or bare host and normalize to websocket URL."""
    value = (raw_url or "").strip()
    if not value:
        return DEFAULT_WS_URL

    if value.startswith(("ws://", "wss://", "http://", "https://")):
        parsed = urlparse(value)
        scheme = "wss" if parsed.scheme in {"https", "wss"} else "ws"
        path = parsed.path if parsed.path and parsed.path != "/" else DEFAULT_WS_PATH
        return urlunparse((scheme, parsed.netloc, path, "", parsed.query, ""))

    # Bare hostname/IP (with optional :port) and optional path.
    parsed = urlparse(f"//{value}")
    if not parsed.netloc:
        raise ValueError(f"Invalid URL: {raw_url}")

    path = parsed.path if parsed.path and parsed.path != "/" else DEFAULT_WS_PATH
    return urlunparse(("ws", parsed.netloc, path, "", parsed.query, ""))


def parse_args():
    parser = argparse.ArgumentParser(description="Collect NILP labeled spikes from websocket stream.")
    parser.add_argument(
        "--url",
        default=os.getenv("WS_URL") or os.getenv("NGROK_URL") or DEFAULT_WS_URL,
        help="Websocket/HTTP endpoint. Examples: ws://127.0.0.1:8000/ws/electrical/ or https://abc.ngrok-free.app/ws/electrical/",
    )
    parser.add_argument(
        "--csv",
        default=CSV_FILENAME,
        help="CSV file to append labeled spike data into.",
    )
    parser.add_argument(
        "--spike-threshold",
        type=float,
        default=SPIKE_THRESHOLD_WATTS,
        help="Minimum positive power jump (watts) to prompt for a label.",
    )
    parser.add_argument(
        "--retry-delay",
        type=int,
        default=DEFAULT_RETRY_DELAY_SECONDS,
        help="Seconds to wait before reconnecting after disconnect.",
    )
    parser.add_argument(
        "--no-ngrok-header",
        action="store_true",
        help="Disable ngrok skip-browser-warning header.",
    )
    return parser.parse_args()

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
        
        # Check for spike (> threshold Watts)
        if power_jump > SPIKE_THRESHOLD_WATTS:
            print(f"\n⚡ SPIKE DETECTED! Jumped by {power_jump:.2f}W")
            try:
                appliance_name = input("❓ What did you just turn on? (Type name or 'Skip'): ")
            except EOFError:
                appliance_name = "Skip"
            
            appliance_name = appliance_name.strip()

            if appliance_name and appliance_name.lower() != 'skip':
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


def run_collector(ws_url, retry_delay_seconds, include_ngrok_header):
    headers = {}
    if include_ngrok_header and "ngrok" in ws_url:
        headers = {"ngrok-skip-browser-warning": "69420"}

    while True:
        ws = websocket.WebSocketApp(
            ws_url,
            on_open=on_open,
            on_message=on_message,
            on_error=on_error,
            on_close=on_close,
            header=headers,
        )

        try:
            ws.run_forever(ping_interval=25, ping_timeout=10)
        except KeyboardInterrupt:
            print("\n🛑 Collector stopped by user.")
            break
        except Exception as error:
            print(f"🔴 Collector crashed: {error}")

        print(f"🔁 Reconnecting in {retry_delay_seconds} seconds...")
        time.sleep(retry_delay_seconds)

if __name__ == "__main__":
    args = parse_args()

    try:
        WS_URL = normalize_ws_url(args.url)
    except ValueError as error:
        raise SystemExit(f"❌ {error}")

    CSV_FILENAME = args.csv
    SPIKE_THRESHOLD_WATTS = args.spike_threshold

    print(f"🔌 WebSocket URL: {WS_URL}")
    print(f"📁 CSV output: {CSV_FILENAME}")
    print(f"📏 Spike threshold: {SPIKE_THRESHOLD_WATTS:.2f}W")

    setup_csv()
    run_collector(
        ws_url=WS_URL,
        retry_delay_seconds=args.retry_delay,
        include_ngrok_header=not args.no_ngrok_header,
    )