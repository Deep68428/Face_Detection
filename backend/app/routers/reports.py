from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from app.database import query as db_query
from datetime import date, datetime, timedelta
import io
import pandas as pd
import math
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

router = APIRouter(prefix="/api/reports", tags=["reports"])


def format_minutes(secs) -> str:
    """Format seconds into a human-readable string like '8h 15m'."""
    try:
        if secs is None: return "—"
        f = float(secs)
        if f <= 0: return "—"
        
        total_mins = int(round(f / 60))
        if total_mins < 1 and f > 0: total_mins = 1 # At least 1 min if any activity
        
        h, m = divmod(total_mins, 60)
        if h > 0:
            return f"{h}h {m}m"
        return f"{m}m"
    except Exception:
        return "—"


def get_report_data(date_from: str, date_to: str, camera: str, emp_code: str):
    """Common logic for fetching employee report data."""
    today = date.today()
    start = date_from or (today - timedelta(days=30)).strftime("%Y-%m-%d")
    end = date_to or today.strftime("%Y-%m-%d")

    params: dict = {"start": start, "end": end}
    extra = ""
    avg_extra = ""
    if camera and camera != "all":
        extra += " AND lower(c.name) LIKE {camera:String}"
        params["camera"] = f"%{camera.lower()}%"
    if emp_code and emp_code != "all":
        extra += " AND ml.emp_code = {emp_code:String}"
        avg_extra += " AND emp_code = {emp_code:String}"
        params["emp_code"] = emp_code

    # Fetch dynamic settings for Late/Early thresholds
    config = db_query("SELECT start_time, end_time FROM config_settings WHERE id = 1")
    start_hour = 10
    end_hour = 19
    if config:
        try:
            start_hour = int(config[0]['start_time'].split(':')[0]) + 1
            end_hour = int(config[0]['end_time'].split(':')[0])
        except: pass

    sql = f"""
        SELECT
            ml.emp_code AS code_grouped,
            ml.emp_name AS name_grouped,
            count() AS total_movements,
            avg(ml.confidence) AS avg_confidence,
            coalesce(any(avg_times.late_days), 0) AS late_arrivals,
            coalesce(any(avg_times.early_exit_days), 0) AS early_exits,
            0 AS flagged_events,
            coalesce(any(avg_times.avg_sec), 0) as avg_daily_sec,
            any(avg_times.first_in) as first_in_str,
            any(avg_times.last_out) as last_out_str
        FROM movement_logs ml
        LEFT JOIN cameras c ON ml.camera_id = c.id
        LEFT JOIN (
            SELECT 
                emp_code,
                coalesce(avgIf(daily_duration_sec, daily_duration_sec > 0), 0) as avg_sec,
                countIf(first_in_hour >= {start_hour} AND first_in_hour > 0) as late_days,
                countIf(last_out_hour < {end_hour} AND last_out_hour > 0) as early_exit_days,
                argMin(first_in_str, d) as first_in,
                argMax(last_out_str, d) as last_out
            FROM (
                SELECT 
                    emp_code,
                    d,
                    minIf(timestamp, direction = 'IN') as first_in_dt,
                    maxIf(timestamp, direction = 'OUT') as last_out_dt,
                    if(toUnixTimestamp(first_in_dt) > 0, formatDateTime(first_in_dt, '%H:%i'), '') as first_in_str,
                    if(toUnixTimestamp(last_out_dt) > 0, formatDateTime(last_out_dt, '%H:%i'), '') as last_out_str,
                    toHour(first_in_dt) as first_in_hour,
                    toHour(last_out_dt) as last_out_hour,
                    sum(interval_sec) as daily_duration_sec
                FROM (
                    SELECT 
                        emp_code,
                        timestamp,
                        direction,
                        toDate(timestamp) as d,
                        if(lagInFrame(direction) OVER (PARTITION BY emp_code, toDate(timestamp) ORDER BY timestamp) = 'IN',
                           dateDiff('second', lagInFrame(timestamp) OVER (PARTITION BY emp_code, toDate(timestamp) ORDER BY timestamp), timestamp),
                           0) +
                        if(direction = 'IN' AND toDate(timestamp) = today() AND 
                           row_number() OVER (PARTITION BY emp_code, toDate(timestamp) ORDER BY timestamp) = count(*) OVER (PARTITION BY emp_code, toDate(timestamp)),
                           dateDiff('second', timestamp, now('Asia/Kolkata')),
                           0) as interval_sec
                    FROM movement_logs
                    WHERE toDate(timestamp) BETWEEN toDate({{start:String}}) AND toDate({{end:String}})
                    {avg_extra}
                    ORDER BY emp_code, timestamp
                )
                GROUP BY emp_code, d
            ) 
            GROUP BY emp_code
        ) AS avg_times ON ml.emp_code = avg_times.emp_code
        WHERE toDate(ml.timestamp) BETWEEN toDate({{start:String}}) AND toDate({{end:String}})
          AND ml.emp_name NOT LIKE 'Unknown%' AND ml.emp_code NOT LIKE 'Unknown%'
          AND ml.emp_name NOT LIKE 'Face_%' AND ml.emp_code NOT LIKE 'Face_%'
        {extra}
        GROUP BY code_grouped, name_grouped
        ORDER BY total_movements DESC
    """
    rows = db_query(sql, params)
    result_rows = []
    for r in rows:
        result_rows.append({
            "code": r["code_grouped"],
            "name": r["name_grouped"],
            "total_movements": r["total_movements"],
            "avg_confidence": r["avg_confidence"],
            "late_arrivals": r["late_arrivals"],
            "early_exits": r["early_exits"],
            "flagged_events": r["flagged_events"],
            "avg_daily_sec": r["avg_daily_sec"],
            "first_in": r["first_in_str"],
            "last_out": r["last_out_str"]
        })
    return result_rows, start, end


@router.get("/export/excel")
def export_excel(
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    camera: str = Query(default=""),
    emp_code: str = Query(default=""),
):
    rows, start, end = get_report_data(date_from, date_to, camera, emp_code)
    
    data = []
    for r in rows:
        data.append({
            "Employee Name": r["name"],
            "Employee Code": r["code"],
            "Total Movements": r["total_movements"],
            "Avg Confidence (%)": round(r["avg_confidence"] or 0),
            "Avg Time/Day": format_minutes(r.get("avg_daily_sec", 0)),
            "Late Arrivals (>10:00)": r["late_arrivals"],
            "Early Exits (<19:00)": r["early_exits"]
        })
        
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Attendance Report')
    
    output.seek(0)
    filename = f"attendance_report_{start}_to_{end}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/pdf")
def export_pdf(
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    camera: str = Query(default=""),
    emp_code: str = Query(default=""),
):
    rows, start, end = get_report_data(date_from, date_to, camera, emp_code)
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=30, rightMargin=30, topMargin=30, bottomMargin=30)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    elements.append(Paragraph(f"Attendance Analytics Report ({start} to {end})", styles['Title']))
    elements.append(Spacer(1, 20))
    
    # Table data
    data = [["Employee Name", "Code", "Movements", "Avg Conf.", "Avg Time", "Late"]]
    for r in rows:
        data.append([
            r["name"],
            r["code"],
            str(r["total_movements"]),
            f"{round(r['avg_confidence'] or 0)}%",
            format_minutes(r.get("avg_daily_sec", 0)),
            str(r["late_arrivals"])
        ])
        
    t = Table(data, hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(t)
    
    doc.build(elements)
    output.seek(0)
    filename = f"attendance_report_{start}_to_{end}.pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/employee")
def employee_report(
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    camera: str = Query(default=""),
    emp_code: str = Query(default=""),
):
    rows, _, _ = get_report_data(date_from, date_to, camera, emp_code)

    return [
        {
            "name": r["name"],
            "code": r["code"],
            "total_movements": r["total_movements"],
            "avg_time": format_minutes(r.get("avg_daily_sec", 0)),
            "late_arrivals": r["late_arrivals"],
            "early_exits": r["early_exits"],
            "confidence": round(r["avg_confidence"] or 0),
            "missing_out": False,
            "first_in": r["first_in"],
            "last_out": r["last_out"],
        }
        for r in rows
    ]


@router.get("/camera")
def camera_report(
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
):
    today = date.today()
    start = date_from or (today - timedelta(days=30)).strftime("%Y-%m-%d")
    end = date_to or today.strftime("%Y-%m-%d")

    rows = db_query(
        """
        SELECT
            coalesce(nullIf(c.name, ''), nullIf(ml.camera_name, ''), 'Unknown Camera') AS camera,
            count() AS total_detections,
            toInt32(round(count() / greatest(dateDiff('day', toDate({start:String}), toDate({end:String})), 1))) AS avg_daily,
            countIf(ml.confidence < 70) AS failed_detections,
            toInt32(argMax(toHour(ml.timestamp), if(ml.direction = 'IN', ml.timestamp, toDateTime(0)))) AS peak_hour
        FROM movement_logs ml
        LEFT JOIN cameras c ON ml.camera_id = c.id
        WHERE toDate(ml.timestamp) BETWEEN toDate({start:String}) AND toDate({end:String})
        GROUP BY camera
        ORDER BY total_detections DESC
        """,
        {"start": start, "end": end},
    )
    return [
        {
            "camera": r["camera"],
            "total_detections": r["total_detections"],
            "avg_daily": int(r["avg_daily"]),
            "peak_hour": f"{int(r['peak_hour']):02d}:00",
            "failed_detections": r["failed_detections"],
        }
        for r in rows
    ]


@router.get("/time-spent")
def time_spent_report():
    """Average hours per weekday for the current week.

    ClickHouse does not allow nested aggregate functions, so we compute
    per-employee per-day min/max timestamps in an inner subquery, then
    average the resulting durations per day-of-week in the outer query.
    """
    rows = db_query(
        """
        SELECT
            dow,
            avg(daily_minutes) / 60.0 AS avg_hours
        FROM (
            SELECT
                toDayOfWeek(d) AS dow,
                emp_code,
                d as day,
                sum(interval_sec) / 60 as daily_minutes
            FROM (
                SELECT 
                    emp_code,
                    timestamp,
                    direction,
                    toDate(timestamp) as d,
                    if(lagInFrame(direction) OVER (PARTITION BY emp_code, toDate(timestamp) ORDER BY timestamp) = 'IN',
                       dateDiff('second', lagInFrame(timestamp) OVER (PARTITION BY emp_code, toDate(timestamp) ORDER BY timestamp), timestamp),
                       0) +
                    if(direction = 'IN' AND toDate(timestamp) = today() AND 
                       row_number() OVER (PARTITION BY emp_code, toDate(timestamp) ORDER BY timestamp) = count(*) OVER (PARTITION BY emp_code, toDate(timestamp)),
                       dateDiff('second', timestamp, now('Asia/Kolkata')),
                       0) as interval_sec
                FROM movement_logs
                WHERE toDate(timestamp) >= toMonday(today())
                ORDER BY emp_code, timestamp
            )
            GROUP BY dow, emp_code, day
            HAVING daily_minutes > 0
        )
        GROUP BY dow
        ORDER BY dow
        """
    )
    day_names = {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun"}
    data_map = {r["dow"]: round(float(r["avg_hours"] or 0), 2) for r in rows}
    return [{"name": day_names[d], "hours": data_map.get(d, 0)} for d in range(1, 8)]


@router.get("/failed-summary")
def failed_summary(date_from: str = "", date_to: str = ""):
    today = date.today()
    start = date_from or (today - timedelta(days=30)).strftime("%Y-%m-%d")
    end = date_to or today.strftime("%Y-%m-%d")

    rows = db_query(
        """
        SELECT
            countIf(confidence < 70) AS failed,
            countIf(confidence >= 70 AND confidence < 80) AS low_confidence
        FROM movement_logs
        WHERE toDate(timestamp) BETWEEN toDate({start:String}) AND toDate({end:String})
        """,
        {"start": start, "end": end},
    )
    r = rows[0] if rows else {}
    return {"failed_detections": r.get("failed", 0), "low_confidence": r.get("low_confidence", 0)}
