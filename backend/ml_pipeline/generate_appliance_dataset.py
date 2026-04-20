import argparse
import csv
import json
import os
import random
from collections import Counter
from datetime import datetime


CSV_COLUMNS = [
    "Power_Jump_Watts",
    "Current_Jump_Amps",
    "Appliance_Name",
    "Event_Type",
    "Source",
    "Rated_Watts_Ref",
]


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_event_type(raw_value, power_jump):
    value = str(raw_value or "").strip().upper()
    if value in {"ON", "OFF"}:
        return value
    return "OFF" if power_jump < 0 else "ON"


def _load_catalog(catalog_path):
    with open(catalog_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    appliances = payload.get("appliances", [])
    if not appliances:
        raise ValueError("Catalog has no appliance definitions.")

    labels = [str(entry.get("label", "")).strip() for entry in appliances]
    if any(not label for label in labels):
        raise ValueError("Every catalog appliance entry must include a non-empty label.")

    return payload


def _load_existing_rows(dataset_path):
    if not os.path.exists(dataset_path) or os.path.getsize(dataset_path) == 0:
        return []

    rows = []
    with open(dataset_path, "r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        for raw_row in reader:
            appliance_name = str(raw_row.get("Appliance_Name", "")).strip()
            if not appliance_name:
                continue

            power_jump = _to_float(raw_row.get("Power_Jump_Watts"))
            current_jump = _to_float(raw_row.get("Current_Jump_Amps"))
            event_type = _normalize_event_type(raw_row.get("Event_Type"), power_jump)
            source = str(raw_row.get("Source", "")).strip() or "user_existing"
            rated_ref = str(raw_row.get("Rated_Watts_Ref", "")).strip()

            rows.append(
                {
                    "Power_Jump_Watts": round(power_jump, 4),
                    "Current_Jump_Amps": round(current_jump, 6),
                    "Appliance_Name": appliance_name,
                    "Event_Type": event_type,
                    "Source": source,
                    "Rated_Watts_Ref": rated_ref,
                }
            )

    return rows


def _sample_power(spec):
    min_power = _to_float(spec.get("power_on_min"), 1.0)
    max_power = max(min_power, _to_float(spec.get("power_on_max"), min_power + 1.0))
    sampled = random.uniform(min_power, max_power)
    jittered = sampled * random.uniform(0.94, 1.06)
    return max(min_power, min(max_power, jittered))


def _sample_current(spec, power_on):
    min_current = _to_float(spec.get("current_on_min"), 0.01)
    max_current = max(min_current, _to_float(spec.get("current_on_max"), min_current + 0.01))

    base_current = random.uniform(min_current, max_current)
    expected_from_power = power_on / 230.0

    mixed = (base_current * 0.6) + (expected_from_power * 0.4)
    mixed = mixed * random.uniform(0.92, 1.08)
    return max(min_current, min(max_current, mixed))


def _generate_synthetic_rows(catalog_payload, rows_per_class, include_off):
    rows = []
    appliances = catalog_payload.get("appliances", [])

    for spec in appliances:
        label = str(spec.get("label", "")).strip()
        rated_watts = _to_float(spec.get("rated_watts"), 0.0)

        on_count = rows_per_class
        off_count = rows_per_class if include_off else 0

        for _ in range(on_count):
            power_on = _sample_power(spec)
            current_on = _sample_current(spec, power_on)
            rows.append(
                {
                    "Power_Jump_Watts": round(power_on, 4),
                    "Current_Jump_Amps": round(current_on, 6),
                    "Appliance_Name": label,
                    "Event_Type": "ON",
                    "Source": "synthetic_catalog",
                    "Rated_Watts_Ref": int(round(rated_watts)) if rated_watts > 0 else "",
                }
            )

        for _ in range(off_count):
            power_on = _sample_power(spec)
            current_on = _sample_current(spec, power_on)
            power_off = -1.0 * power_on * random.uniform(0.86, 1.02)
            current_off = -1.0 * current_on * random.uniform(0.86, 1.02)
            rows.append(
                {
                    "Power_Jump_Watts": round(power_off, 4),
                    "Current_Jump_Amps": round(current_off, 6),
                    "Appliance_Name": label,
                    "Event_Type": "OFF",
                    "Source": "synthetic_catalog",
                    "Rated_Watts_Ref": int(round(rated_watts)) if rated_watts > 0 else "",
                }
            )

    return rows


def _dedupe_rows(rows):
    seen = set()
    deduped = []

    for row in rows:
        key = (
            str(row.get("Appliance_Name", "")).strip().lower(),
            str(row.get("Event_Type", "")).strip().upper(),
            round(_to_float(row.get("Power_Jump_Watts")), 3),
            round(_to_float(row.get("Current_Jump_Amps")), 5),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)

    return deduped


def _backup_file(dataset_path):
    if not os.path.exists(dataset_path):
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{dataset_path}.{timestamp}.bak"

    with open(dataset_path, "rb") as source, open(backup_path, "wb") as target:
        target.write(source.read())

    return backup_path


def _write_rows(dataset_path, rows, mode):
    if mode == "append":
        file_exists = os.path.exists(dataset_path)
        with open(dataset_path, "a", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
            if not file_exists or os.path.getsize(dataset_path) == 0:
                writer.writeheader()
            for row in rows:
                writer.writerow(row)
        return

    with open(dataset_path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _print_summary(rows):
    counts = Counter(row["Appliance_Name"] for row in rows)
    event_counts = Counter(row["Event_Type"] for row in rows)

    print("✅ Dataset generation complete")
    print(f"📦 Total rows written: {len(rows)}")
    print(f"📈 Event mix: ON={event_counts.get('ON', 0)} OFF={event_counts.get('OFF', 0)}")
    print(f"🏷️ Classes: {len(counts)}")

    for label, count in sorted(counts.items()):
        print(f"  - {label}: {count}")


def parse_args():
    current_dir = os.path.dirname(os.path.abspath(__file__))

    parser = argparse.ArgumentParser(
        description="Generate realistic appliance NILP starter data from a rated-watt catalog."
    )
    parser.add_argument(
        "--catalog",
        default=os.path.join(current_dir, "appliance_catalog.json"),
        help="Path to appliance catalog JSON file.",
    )
    parser.add_argument(
        "--dataset",
        default=os.path.join(current_dir, "my_appliances_dataset.csv"),
        help="Path to NILP dataset CSV.",
    )
    parser.add_argument(
        "--rows-per-class",
        type=int,
        default=18,
        help="Rows to generate per class per event type (ON and optional OFF).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducible synthetic generation.",
    )
    parser.add_argument(
        "--mode",
        choices=["replace", "append"],
        default="replace",
        help="Replace dataset or append generated rows.",
    )
    parser.add_argument(
        "--preserve-existing",
        action="store_true",
        help="When mode=replace, include existing rows in the output dataset.",
    )
    parser.add_argument(
        "--no-off-events",
        action="store_true",
        help="Generate ON events only.",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    if args.rows_per_class < 1:
        raise SystemExit("❌ --rows-per-class must be at least 1")

    random.seed(args.seed)

    catalog_payload = _load_catalog(args.catalog)
    generated_rows = _generate_synthetic_rows(
        catalog_payload=catalog_payload,
        rows_per_class=args.rows_per_class,
        include_off=not args.no_off_events,
    )

    rows_to_write = list(generated_rows)

    if args.mode == "replace" and args.preserve_existing:
        rows_to_write = _load_existing_rows(args.dataset) + rows_to_write

    rows_to_write = _dedupe_rows(rows_to_write)

    backup_path = None
    if args.mode == "replace":
        backup_path = _backup_file(args.dataset)

    _write_rows(args.dataset, rows_to_write, args.mode)

    if backup_path:
        print(f"🗄️ Backup created: {backup_path}")

    _print_summary(rows_to_write)


if __name__ == "__main__":
    main()
