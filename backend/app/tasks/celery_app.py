from celery import Celery

from app.config import settings

celery_app = Celery("dronedata", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_acks_late=True,
    broker_transport_options={"visibility_timeout": 43200},
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

celery_app.autodiscover_tasks(["app.tasks"])

# Ensure workers register tasks without importing the FastAPI app first.
import app.tasks.calibration_tasks  # noqa: E402, F401
import app.tasks.processing_tasks  # noqa: E402, F401
