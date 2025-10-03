"""Utilities for the automatic watermark detection toolkit."""

from __future__ import annotations

import importlib
from types import ModuleType
from typing import Any, Iterable, Iterator, List

_SUBMODULES: tuple[str, ...] = (
    "estimate_watermark",
    "preprocess",
    "image_crawler",
    "watermark_reconstruct",
)


class _LazyExports(List[str]):
    """Populate ``__all__`` lazily so optional deps do not block import."""

    def __init__(self, modules: Iterable[str]):
        super().__init__()
        self._modules = tuple(modules)
        self._loaded = False

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return

        exported: list[str] = []
        for module_name in self._modules:
            module = importlib.import_module(f".{module_name}", __name__)
            names = getattr(module, "__all__", None)
            if names is None:
                names = [name for name in dir(module) if not name.startswith("_")]
            for name in names:
                globals()[name] = getattr(module, name)
            exported.extend(names)

        super().extend(exported)
        self._loaded = True

    # ``from module import *`` checks len() before iterating.
    def __len__(self) -> int:  # type: ignore[override]
        self._ensure_loaded()
        return super().__len__()

    def __iter__(self) -> Iterator[str]:  # type: ignore[override]
        self._ensure_loaded()
        return super().__iter__()

    def __contains__(self, item: object) -> bool:  # type: ignore[override]
        self._ensure_loaded()
        return super().__contains__(item)

    def __repr__(self) -> str:  # type: ignore[override]
        if not self._loaded:
            return f"_LazyExports(modules={self._modules!r})"
        return super().__repr__()


__all__ = _LazyExports(_SUBMODULES)


def __getattr__(name: str) -> Any:
    if name in globals():
        return globals()[name]

    for module_name in _SUBMODULES:
        module: ModuleType = importlib.import_module(f".{module_name}", __name__)
        if hasattr(module, name):
            attr = getattr(module, name)
            globals()[name] = attr
            return attr

    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


def __dir__() -> list[str]:
    names = set(globals())
    names.update(__all__)
    return sorted(names)
