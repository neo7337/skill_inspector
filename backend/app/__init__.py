from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("skill-inspector")
except PackageNotFoundError:
    __version__ = "unknown"