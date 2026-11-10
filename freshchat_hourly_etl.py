import requests
import time
import zipfile
import io
import pandas as pd
import gspread
import json
from google.oauth2.service_account import Credentials
from datetime import datetime, timedelta, timezone
import os
import traceback
from zoneinfo import ZoneInfo

# =========================
# CONFIGURATION
# =========================

FRESHCHAT_DOMAIN = "https://tempo-606018293146678274-869026d6297b73c16908009.freshchat.com"
CREATE_EXPORT_URL = f"{FRESHCHAT_DOMAIN}/v2/reports/raw"

# 🔒 Token kept HARDCODED as requested
FRESHCHAT_BEARER_TOKEN = os.getenv(
    "FRESHCHAT_TOKEN",
    "eyJraWQiOiJjdXN0b20tb2F1dGgta2V5aWQiLCJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmcmVzaGNoYXQiLCJzdWIiOiJiZGFlNzdlMS01NzM1LTQ0MTgtYmQ1Yi01YjgyMmE0NTc1MDIiLCJjbGllbnRJZCI6ImZjLTEzMzk4NjRhLTgzNzYtNGM3MC1iOGM1LTJlYmUzZjhjNjY1MSIsInNjb3BlIjoiYWdlbnQ6cmVhZCBhZ2VudDpjcmVhdGUgYWdlbnQ6dXBkYXRlIGFnZW50OmRlbGV0ZSBjb252ZXJzYXRpb246Y3JlYXRlIGNvbnZlcnNhdGlvbjpyZWFkIGNvbnZlcnNhdGlvbjp1cGRhdGUgbWVzc2FnZTpjcmVhdGUgbWVzc2FnZTpnZXQgYmlsbGluZzp1cGRhdGUgcmVwb3J0czpmZXRjaCByZXBvcnRzOmV4dHJhY3QgcmVwb3J0czpyZWFkIHJlcG9ydHM6ZXh0cmFjdDpyZWFkIGFjY291bnQ6cmVhZCBkYXNoYm9hcmQ6cmVhZCB1c2VyOnJlYWQgdXNlcjpjcmVhdGUgdXNlcjp1cGRhdGUgdXNlcjpkZWxldGUgb3V0Ym91bmRtZXNzYWdlOnNlbmQgb3V0Ym91bmRtZXNzYWdlOmdldCBtZXNzYWdpbmctY2hhbm5lbHM6bWVzc2FnZTpzZW5kIG1lc3NhZ2luZy1jaGFubmVsczptZXNzYWdlOmdldCBtZXNzYWdpbmctY2hhbm5lbHM6dGVtcGxhdGU6Y3JlYXRlIG1lc3NhZ2luZy1jaGFubmVsczp0ZW1wbGF0ZTpnZXQgZmlsdGVyaW5ib3g6cmVhZCBmaWx0ZXJpbmJveDpjb3VudDpyZWFkIHJvbGU6cmVhZCBpbWFnZTp1cGxvYWQiLCJpc3MiOiJmcmVzaGNoYXQiLCJ0eXAiOiJCZWFyZXIiLCJleHAiOjIwMDc3NDUxMjcsImlhdCI6MTY5MjEyNTkyNywianRpIjoiZDZkODk5OTEtYWU5Zi00MDQyLWJkZWMtYTU1ZmUyZDg3MmRhIn0.wj8lTFHKb_s2Bamk6ftNg60Iba4IPByWC9eVoQHOujI"
)

SPREADSHEET_ID = "1PAVgZ5A0mn1t1sphlS_1PhRZoHAA0Wzv39eU9K39VG8"
# Ensure script uses absolute paths for cron execution
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GOOGLE_CREDS_FILE = os.path.join(BASE_DIR, "service_account.json")

# Supabase Config
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://kupaxfvjfobfdgtbfnnt.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cGF4ZnZqZm9iZmRndGJmbm50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4NDA2MDA5OCwiZXhwIjoxOTk5NjM2MDk4fQ.zdeD358JXMMrUzRg9mmBnPAjlkgk8jAROkQ64v98vj0")
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# =========================
# STEP 0 - LOGGING & HELPERS
# =========================

def get_google_creds():
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    google_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
    
    if google_creds_json:
        try:
            creds_info = json.loads(google_creds_json)
            return Credentials.from_service_account_info(creds_info, scopes=scopes)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Invalid JSON in GOOGLE_CREDENTIALS_JSON env var: {e}")
    elif os.path.exists(GOOGLE_CREDS_FILE):
        return Credentials.from_service_account_file(GOOGLE_CREDS_FILE, scopes=scopes)
    else:
        raise FileNotFoundError(f"Neither GOOGLE_CREDENTIALS_JSON env var nor {GOOGLE_CREDS_FILE} found.")

def _coerce_int(value, default=0):
    if value is None:
        return default
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        v = value.strip()
        if v.isdigit():
            return int(v)
        try:
            return int(float(v))
        except Exception:
            return default
    if isinstance(value, list) and value:
        return _coerce_int(value[0], default=default)
    if isinstance(value, dict):
        for k in ("max", "max_id", "id", "value"):
            if k in value:
                return _coerce_int(value.get(k), default=default)
    return default

def get_max_id_from_supabase():
    url = f"{SUPABASE_URL}/rest/v1/rpc/get_max_freshworks_id"
    try:
        response = requests.post(url, headers=SUPABASE_HEADERS, timeout=30)
        if response.ok:
            # RPC returns the value directly, e.g., 12345 or "12345"
            # It might return null/None if table is empty
            val = response.json()
            max_id = _coerce_int(val, default=0)
            print(f"Fetched Max ID from Supabase: {val} -> parsed={max_id}")
            return max_id
        else:
            print(f"WARNING: Failed to fetch Max ID: {response.text}")
            return 0
    except Exception as e:
        print(f"WARNING: Error fetching Max ID: {e}")
        return 0

def _find_interaction_id_column(df):
    if df is None or df.empty:
        return None
    for c in df.columns:
        if str(c).lower().strip() in ("interaction_id", "interaction id", "interactionid"):
            return c
    return None

def fill_missing_timestamps_from_interaction_id(df):
    if df is None or df.empty:
        return df

    def _is_missing(series):
        s = series
        return s.isna() | (s.astype(str).str.strip() == "") | (s.astype(str).str.lower() == "nan")

    def _format_cairo_with_ms(dt_series):
        s = dt_series.dt.strftime("%Y-%m-%d %H:%M:%S.%f")
        return s.str.slice(0, 23)

    epoch_ms = pd.to_numeric(pd.Series([pd.NA] * len(df), index=df.index), errors="coerce")

    interaction_id_col = _find_interaction_id_column(df)
    if interaction_id_col and interaction_id_col in df.columns:
        interaction_id_series = df[interaction_id_col].astype(str)
        suffix = interaction_id_series.str.split("-", n=1).str[1]
        epoch_ms = pd.to_numeric(suffix, errors="coerce")

    created_epoch_cols = [
        "created_timestamp_r",
        "created_timestamp_nr",
        "created_timestamp_millis",
        "created_timestamp_ms",
    ]
    for col in created_epoch_cols:
        if col in df.columns:
            series_epoch = pd.to_numeric(df[col], errors="coerce")
            epoch_ms = epoch_ms.fillna(series_epoch)

    dt_utc = pd.to_datetime(epoch_ms, unit="ms", utc=True, errors="coerce")
    dt_cairo = dt_utc.dt.tz_convert("Africa/Cairo")

    for col in created_epoch_cols:
        if col in df.columns:
            df[col] = df[col].astype("object")
            mask = _is_missing(df[col]) & epoch_ms.notna()
            if mask.any():
                df.loc[mask, col] = epoch_ms.loc[mask].astype("Int64").astype(str)

    if "created_timestamp" in df.columns:
        df["created_timestamp"] = df["created_timestamp"].astype("object")
        mask = _is_missing(df["created_timestamp"]) & dt_cairo.notna()
        if mask.any():
            df.loc[mask, "created_timestamp"] = _format_cairo_with_ms(dt_cairo.loc[mask])

        remaining_missing = _is_missing(df["created_timestamp"])
        if remaining_missing.any():
            s = df["created_timestamp"].copy()
            s = s.mask(_is_missing(s), pd.NA).astype("string")
            if s.notna().any():
                filled = s.ffill()
                if _is_missing(filled).any():
                    filled = filled.bfill()
                df.loc[remaining_missing, "created_timestamp"] = filled.loc[remaining_missing]

    for col in created_epoch_cols:
        if col in df.columns:
            remaining_missing = _is_missing(df[col])
            if remaining_missing.any():
                s = df[col].copy()
                s = s.mask(_is_missing(s), pd.NA).astype("string")
                if s.notna().any():
                    filled = s.ffill()
                    if _is_missing(filled).any():
                        filled = filled.bfill()
                    df.loc[remaining_missing, col] = filled.loc[remaining_missing]

    for col, getter in [
        ("Year", lambda s: s.dt.year.astype("Int64").astype(str)),
        ("Month", lambda s: s.dt.month.astype("Int64").astype(str)),
        ("Day", lambda s: s.dt.day.astype("Int64").astype(str)),
    ]:
        if col in df.columns:
            df[col] = df[col].astype("object")
            mask = _is_missing(df[col]) & dt_cairo.notna()
            if mask.any():
                df.loc[mask, col] = getter(dt_cairo.loc[mask])

    return df

def sleep_until_cairo_minute(minute=1):
    tz = ZoneInfo("Africa/Cairo")
    now = datetime.now(tz)
    target = now.replace(minute=minute, second=0, microsecond=0)
    if now >= target:
        target = target + timedelta(hours=1)
    sleep_seconds = max(0, int((target - now).total_seconds()))
    if sleep_seconds > 0:
        print(f"Waiting until {target.isoformat()} (Cairo) to start run. Sleeping {sleep_seconds}s...")
        time.sleep(sleep_seconds)

def update_sheet_cell(client, sheet_name, cell, value):
    try:
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(sheet_name)
        worksheet.update(cell, [[value]])
        print(f"Updated '{sheet_name}!{cell}' with value: {value}")
    except Exception as e:
        print(f"ERROR: Failed to update '{sheet_name}!{cell}': {e}")
        # We continue even if this fails, though it might affect the Upload sheet logic

def read_sheet_data(client, sheet_name):
    try:
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(sheet_name)
        # Get all records as list of dicts
        records = worksheet.get_all_records()
        print(f"Read {len(records)} rows from '{sheet_name}'.")
        return records
    except Exception as e:
        print(f"ERROR: Failed to read from '{sheet_name}': {e}")
        raise

def log_to_supabase(event_name, status, message, rows_count=0):
    url = f"{SUPABASE_URL}/rest/v1/etl_logs"
    payload = {
        "event_name": event_name,
        "status": status,
        "message": str(message)[:500],  # Truncate long messages
        "rows_processed": rows_count,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        response = requests.post(url, json=payload, headers=SUPABASE_HEADERS, timeout=10)
        if not response.ok:
            print(f"WARNING: Failed to write log to Supabase: {response.text}")
    except Exception as e:
        print(f"WARNING: Failed to write log to Supabase: {e}")

def _parse_cairo_dt(value, is_end=False):
    dt = datetime.fromisoformat(value)
    cairo_tz = ZoneInfo("Africa/Cairo")
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=cairo_tz)
    else:
        dt = dt.astimezone(cairo_tz)
    if is_end:
        if dt.second == 0 and dt.microsecond == 0:
            dt = dt.replace(second=59, microsecond=999999)
    else:
        dt = dt.replace(second=0, microsecond=0)
    return dt

def get_time_window_utc_and_cairo():
    from_cairo_raw = os.getenv("FROM_CAIRO") or os.getenv("ETL_FROM_CAIRO")
    to_cairo_raw = os.getenv("TO_CAIRO") or os.getenv("ETL_TO_CAIRO")

    if from_cairo_raw and to_cairo_raw:
        start_cairo = _parse_cairo_dt(from_cairo_raw, is_end=False)
        end_cairo = _parse_cairo_dt(to_cairo_raw, is_end=True)
    else:
        cairo_tz = ZoneInfo("Africa/Cairo")
        now_cairo = datetime.now(cairo_tz)
        current_hour_start_cairo = now_cairo.replace(minute=0, second=0, microsecond=0)
        start_cairo = current_hour_start_cairo - timedelta(hours=1)
        end_cairo = current_hour_start_cairo - timedelta(seconds=1)

    start_utc = start_cairo.astimezone(timezone.utc)
    end_utc = end_cairo.astimezone(timezone.utc)
    return start_utc, end_utc, start_cairo, end_cairo

# =========================
# STEP 1 - CREATE EXPORT
# =========================

def create_export(event_name, start_time, end_time):
    headers = {
        "Authorization": f"Bearer {FRESHCHAT_BEARER_TOKEN}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    payload = {
        "start": start_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "end": end_time.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "event": event_name,
        "format": "csv"
    }

    print(f"Requesting export for '{event_name}' from {payload['start']} to {payload['end']}...")

    # Simple retry for 429
    max_retries = 1
    response = None
    for attempt in range(max_retries + 1):
        try:
            response = requests.post(CREATE_EXPORT_URL, json=payload, headers=headers, timeout=120)
            
            if response.status_code == 429:
                if attempt < max_retries:
                    print("Rate limited (429). Waiting 65 seconds before retry...")
                    time.sleep(65)
                    continue
                else:
                    raise RuntimeError(f"Freshchat export failed (429): Rate limit exceeded after retry. {response.text}")
            
            if not response.ok:
                raise RuntimeError(f"Freshchat export failed ({response.status_code}): {response.text}")
            
            break
        except requests.RequestException as e:
            if attempt < max_retries:
                print(f"Request failed: {e}. Retrying...")
                time.sleep(5)
                continue
            raise

    # Handle async response
    data = response.json()
    link = data.get("link", {})
    href = link.get("href")
    
    if not href:
        raise RuntimeError(f"No status link in response: {data}")

    print(f"Report generation started. Polling status at {href}...")
    
    # Construct polling URL
    from urllib.parse import urlparse
    parsed = urlparse(CREATE_EXPORT_URL)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    
    # Ensure /v2 prefix if missing in href but present in report_url
    if "/v2/" in CREATE_EXPORT_URL and "/v2/" not in href:
        poll_url = f"{base_url}/v2{href}"
    else:
        poll_url = f"{base_url}{href}"
        
    # Poll for completion
    # Increase timeout/attempts for "Classic" reports as they take longer
    max_poll_attempts = 60 if event_name == "Classic" else 30
    poll_interval = 10

    for i in range(max_poll_attempts):
        time.sleep(poll_interval)
        print(f"Polling attempt {i+1}/{max_poll_attempts}...")
        poll_res = requests.get(poll_url, headers=headers, timeout=60)
        
        if poll_res.ok:
            poll_data = poll_res.json()
            status = poll_data.get("status")
            print(f"Poll status: {status}")
            
            if status == "COMPLETED":
                # Check for download link
                dl_link = poll_data.get("link", {})
                dl_url = dl_link.get("href")
                
                if not dl_url:
                    # Try to find links array if it exists
                    links = poll_data.get("links", [])
                    for link_item in links:
                        # CASE 1: { "link": { "rel": "...", "href": "..." } } (Nested structure)
                        inner_link = link_item.get("link")
                        if inner_link and inner_link.get("rel") in ("extraction", "download", "raw_reports"):
                            dl_url = inner_link.get("href")
                            break
                        
                        # CASE 2: { "rel": "...", "href": "..." } (Flat structure)
                        if link_item.get("rel") in ("extraction", "download", "raw_reports"):
                            dl_url = link_item.get("href")
                            break
                
                if dl_url:
                    print(f"Downloading report from {dl_url.split('?')[0]}...")
                    if "freshchat.com" in dl_url:
                        dl_res = requests.get(dl_url, headers=headers, timeout=120)
                    else:
                        dl_res = requests.get(dl_url, timeout=120)
                        
                    if dl_res.ok:
                        return dl_res.content
                    else:
                        raise RuntimeError(f"Download failed: {dl_res.status_code} {dl_res.text}")
                else:
                    raise RuntimeError(f"Report completed but no download link found in payload: {json.dumps(poll_data)}")
            elif status == "FAILED":
                raise RuntimeError(f"Report generation failed: {poll_data}")
        else:
            print(f"Poll request failed: {poll_res.status_code} {poll_res.text}")
            
    raise RuntimeError("Report generation timed out after 5 minutes.")


# =========================
# STEP 2 - EXTRACT CSV
# =========================

def extract_csv_from_zip(zip_content):
    with zipfile.ZipFile(io.BytesIO(zip_content)) as z:
        for file_name in z.namelist():
            if file_name.endswith(".csv"):
                with z.open(file_name) as f:
                    try:
                        return pd.read_csv(f)
                    except pd.errors.EmptyDataError:
                        print(f"CSV '{file_name}' inside ZIP was empty. Treating it as 0 rows.")
                        return pd.DataFrame()
    raise Exception("No CSV found inside ZIP")


# =========================
# STEP 3 - GOOGLE SHEETS
# =========================

def upload_to_google_sheets(client, df, sheet_name):
    """
    Updates a specific worksheet with DataFrame content.
    Assumes client is already authenticated.
    """
    spreadsheet = client.open_by_key(SPREADSHEET_ID)

    try:
        worksheet = spreadsheet.worksheet(sheet_name)
    except gspread.exceptions.WorksheetNotFound:
        print(f"Worksheet '{sheet_name}' not found. Creating it...")
        worksheet = spreadsheet.add_worksheet(title=sheet_name, rows="1000", cols="20")

    existing_headers = []
    try:
        existing_headers = worksheet.row_values(1)
    except Exception:
        existing_headers = []

    # Clear sheet
    worksheet.clear()
    try:
        sheet_id = worksheet._properties.get("sheetId")
        if sheet_id is not None:
            spreadsheet.batch_update(
                {
                    "requests": [
                        {
                            "unmergeCells": {
                                "range": {
                                    "sheetId": sheet_id,
                                    "startRowIndex": 0,
                                    "endRowIndex": worksheet.row_count,
                                    "startColumnIndex": 0,
                                    "endColumnIndex": worksheet.col_count,
                                }
                            }
                        }
                    ]
                }
            )
    except Exception as e:
        print(f"WARNING: Failed to unmerge cells in '{sheet_name}': {e}")

    # Replace NaN with empty string
    df = df.fillna("").astype(str)

    if len(df.columns) == 0 and existing_headers:
        print(f"'{sheet_name}' export returned no columns. Preserving existing headers with 0 data rows.")
        data = [existing_headers]
        worksheet.update("A1", data, value_input_option="RAW")
        print(f"Google Sheet '{sheet_name}' updated successfully with existing headers only.")
        return

    # Write headers + data starting row 1 (A1)
    data = [df.columns.tolist()] + df.values.tolist()
    worksheet.update("A1", data, value_input_option="RAW")

    print(f"Google Sheet '{sheet_name}' updated successfully.")


# =========================
# STEP 4 - UPLOAD TO SUPABASE (NEW)
# =========================

def upload_records_to_supabase(records, table_name="Freshworks", log_event_name=None):
    """
    Uploads a list of dicts to the specified Supabase table.
    """
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    
    if not records:
        print("No records to upload.")
        return 0

    def _normalize_value(v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            if s == "" or s.lower() == "nan":
                return None
            return s
        return v

    def _normalize_record(rec):
        if not isinstance(rec, dict):
            return rec
        return {k: _normalize_value(v) for k, v in rec.items()}
    
    # Batch upload
    batch_size = 1000
    total_uploaded = 0
    
    for i in range(0, len(records), batch_size):
        batch = [_normalize_record(r) for r in records[i:i + batch_size]]
        print(f"Uploading batch {i//batch_size + 1} ({len(batch)} records)...")
        if log_event_name:
            log_to_supabase(log_event_name, "INFO", f"Uploading batch {i//batch_size + 1} ({len(batch)} records)", len(batch))
        
        try:
            # We use 'upsert' behavior usually, but here we just POST (Insert)
            # If duplicates exist, it might fail depending on constraints.
            # Assuming 'Upload' sheet logic handles deduplication or we want all rows.
            # The GAS script used POST, so we stick to that.
            
            response = requests.post(url, json=batch, headers=SUPABASE_HEADERS, timeout=60)
            if not response.ok:
                raise RuntimeError(f"Supabase upload failed: {response.text}")
            print("Batch upload successful.")
            total_uploaded += len(batch)
            if log_event_name:
                log_to_supabase(log_event_name, "INFO", f"Batch {i//batch_size + 1} uploaded successfully", len(batch))
        except Exception as e:
            print(f"Error uploading batch to Supabase: {e}")
            raise # Re-raise to be caught by main loop
            
    return total_uploaded


# =========================
# MAIN JOB
# =========================

def run_job():
    print(f"Job started at {datetime.now()}")
    run_started_at = datetime.now(timezone.utc)
    log_to_supabase("ETL_RUN", "STARTED", f"Run started at {run_started_at.isoformat()}")
    had_errors = False

    # 1. Auth GSheets
    try:
        creds = get_google_creds()
        client = gspread.authorize(creds)
    except Exception as e:
        print(f"CRITICAL: Google Auth failed: {e}")
        log_to_supabase("ETL_START", "FAILED", f"Google Auth failed: {e}")
        return

    # 2. Fetch Max ID & Update Sheet (Pre-processing)
    # This replaces GAS `runApi` fetching max ID
    max_id = get_max_id_from_supabase()
    next_id = (max_id or 0) + 1
    log_to_supabase("ETL_RUN", "INFO", f"Max ID fetched from Supabase: {max_id} | Next ID: {next_id}")
    update_sheet_cell(client, "ChatDataHelper", "Z1", next_id)
    log_to_supabase("ETL_RUN", "INFO", "Updated ChatDataHelper!Z1 with Next ID")
    
    start_time, end_time, start_cairo, end_cairo = get_time_window_utc_and_cairo()
    log_to_supabase(
        "ETL_RUN",
        "INFO",
        f"Time window Cairo: {start_cairo.isoformat()} to {end_cairo.isoformat()} | UTC: {start_time.isoformat()} to {end_time.isoformat()}",
    )

    # Define tasks: (Event Name, Google Sheet Name)
    tasks = [
        ("First-Response-Time", "Chat & Email Data(FRT)"),
        ("Classic", "Phone Data(Classic)"),
    ]

    # 4. Run Exports & Update Sheets
    print("\n--- PHASE 1: Exports & Sheet Updates ---")
    log_to_supabase("ETL_RUN", "INFO", "Phase 1 started: Exports & Sheet Updates")
    for idx, (event_name, sheet_name) in enumerate(tasks):
        if idx == 1 and event_name == "Classic":
            time.sleep(60)
        print(f"\nProcessing '{event_name}' -> '{sheet_name}'")
        try:
            log_to_supabase(event_name, "INFO", "Requesting export")
            zip_content = create_export(event_name, start_time, end_time)
            log_to_supabase(event_name, "INFO", "Export generated and downloaded")
            df = extract_csv_from_zip(zip_content)
            row_count = len(df)
            print(f"Extracted {row_count} rows.")
            log_to_supabase(event_name, "INFO", "CSV extracted", row_count)

            df = fill_missing_timestamps_from_interaction_id(df)
            
            # Update GSheet
            log_to_supabase(event_name, "INFO", f"Updating Google Sheet: {sheet_name}", row_count)
            upload_to_google_sheets(client, df, sheet_name)
            log_to_supabase(event_name, "INFO", f"Google Sheet updated: {sheet_name}", row_count)
            
            # Log success for this part
            log_to_supabase(event_name, "SUCCESS", "Export & Sheet Update completed", row_count)

        except Exception as e:
            error_msg = str(e)
            print(f"ERROR processing '{event_name}': {error_msg}")
            print(traceback.format_exc())
            log_to_supabase(event_name, "FAILED", error_msg)
            had_errors = True

    # 5. Wait for GSheets Formulas
    print("\n--- PHASE 2: Sync Delay ---")
    delay_seconds = 60
    print(f"Waiting {delay_seconds} seconds for Google Sheets formulas to update...")
    log_to_supabase("ETL_RUN", "INFO", f"Phase 2: Waiting {delay_seconds} seconds for sheet sync")
    time.sleep(delay_seconds)
    log_to_supabase("ETL_RUN", "INFO", "Phase 2 completed: Sheet sync wait finished")

    # 6. Read 'Upload' Sheet & Push to Supabase
    print("\n--- PHASE 3: Upload to Supabase ---")
    if had_errors:
        print("Skipping Supabase upload because at least one export/sheet update failed.")
        log_to_supabase("Supabase_Upload", "SKIPPED", "Skipped because Phase 1 had one or more failures")
        print("\nAll jobs finished.")
        log_to_supabase("ETL_RUN", "FAILED", "Run finished with Phase 1 failures")
        return

    try:
        log_to_supabase("Supabase_Upload", "INFO", "Reading rows from Upload sheet")
        upload_data = read_sheet_data(client, "Upload")
        if upload_data:
            log_to_supabase("Supabase_Upload", "INFO", f"Read {len(upload_data)} rows from Upload sheet", len(upload_data))

            count = upload_records_to_supabase(upload_data, "Freshworks", log_event_name="Supabase_Upload")
            log_to_supabase("Supabase_Upload", "SUCCESS", "Uploaded rows from 'Upload' sheet", count)
        else:
            print("No data found in 'Upload' sheet.")
            log_to_supabase("Supabase_Upload", "SKIPPED", "No data in 'Upload' sheet")
            
    except Exception as e:
        print(f"ERROR in Supabase Upload phase: {e}")
        log_to_supabase("Supabase_Upload", "FAILED", str(e))
        had_errors = True

    print("\nAll jobs finished.")
    log_to_supabase("ETL_RUN", "FAILED" if had_errors else "SUCCESS", "Run finished")


if __name__ == "__main__":
    run_mode = os.getenv("ETL_RUN_MODE", "once").strip().lower()
    cairo_minute = int(os.getenv("ETL_CAIRO_MINUTE", "1"))

    if run_mode in {"loop", "forever"}:
        while True:
            sleep_until_cairo_minute(cairo_minute)
            run_job()
    else:
        if os.getenv("ETL_ENFORCE_CAIRO_MINUTE", "1").strip() == "1":
            tz = ZoneInfo("Africa/Cairo")
            now = datetime.now(tz)
            if now.minute != cairo_minute:
                print(
                    f"Skip run: Cairo minute is {now.minute}, expected {cairo_minute} "
                    f"(set ETL_ENFORCE_CAIRO_MINUTE=0 to bypass)."
                )
                raise SystemExit(0)

        run_job()
