from datetime import datetime, timezone, timedelta

def to_gmt7(dt: datetime) -> datetime:
    if dt is None:
        return None
    # If the datetime is naive, assume it is UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    # Convert to GMT+7 timezone
    gmt7_tz = timezone(timedelta(hours=7))
    return dt.astimezone(gmt7_tz)
