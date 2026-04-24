import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TaskInfo:
    uuid: str
    status: str
    progress: float


class ODMClient:
    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port
        try:
            from pyodm import Node  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("PyODM is not available. Install 'pyodm' to use processing.") from exc
        self.node = Node(host, port)

    def create_task(self, project_id: str, image_paths: list[Path], options: dict) -> str:
        files = [str(path) for path in image_paths]
        task = self.node.create_task(files, options)
        return str(task.uuid)

    def get_task_info(self, task_uuid: str) -> TaskInfo:
        task = self.node.get_task(task_uuid)
        info = task.info()
        status = str(info.status.name).lower()
        progress = float(getattr(info, "progress", 0.0) or 0.0)
        return TaskInfo(uuid=task_uuid, status=status, progress=progress)

    def wait_for_completion(
        self, task_uuid: str, on_progress: Callable[[TaskInfo], None], poll_interval_s: int = 5
    ) -> None:
        terminal_states = {"completed", "failed", "canceled"}
        while True:
            info = self.get_task_info(task_uuid)
            on_progress(info)
            if info.status in terminal_states:
                return
            time.sleep(poll_interval_s)

    def download_assets(self, task_uuid: str, output_dir: Path) -> None:
        output_dir.mkdir(parents=True, exist_ok=True)
        task = self.node.get_task(task_uuid)
        task.download_assets(str(output_dir))

    def cancel_task(self, task_uuid: str) -> None:
        task = self.node.get_task(task_uuid)
        task.cancel()
