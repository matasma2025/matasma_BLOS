"""No-network regression test of UTC connection options in every auth mode."""
import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch


class DatabaseTimezoneTest(unittest.TestCase):
    def test_connection_modes_use_utc_without_changing_auth_or_existing_options(self):
        source = ast.parse(Path(__file__).with_name("database.py").read_text())
        function = next(
            node for node in source.body
            if isinstance(node, ast.FunctionDef) and node.name == "get_db_connection"
        )
        calls = []
        connection = object()

        def connect(*args, **kwargs):
            calls.append((args, kwargs))
            return connection

        settings = SimpleNamespace(
            DB_AUTH_MODE="", DB_HOST="fixture.invalid", DB_USER="fixture",
            DB_NAME="fixture", DB_PASSWORD="fixture", DATABASE_URL="fixture-dsn",
        )
        namespace = {
            "settings": settings,
            "psycopg2": SimpleNamespace(connect=connect),
            "parse_dsn": lambda _: {"options": "-c statement_timeout=10000"},
            "logger": SimpleNamespace(error=lambda _: None),
        }
        # Execute only the function, not config/bootstrap or real credentials.
        exec(compile(ast.Module(body=[function], type_ignores=[]), "database.py", "exec"), namespace)
        with patch.dict("sys.modules", {
            "utils.entra_token": SimpleNamespace(get_entra_token=lambda: "fixture-token"),
        }):
            for mode in ["", "neon", "postgres-azure", "entra", "hybrid"]:
                with self.subTest(mode=mode):
                    settings.DB_AUTH_MODE = mode
                    self.assertIs(namespace["get_db_connection"](), connection)
                    args, kwargs = calls[-1]
                    self.assertTrue(kwargs["options"].endswith("-c timezone=UTC"))
                    if mode in ("", "neon"):
                        self.assertEqual(args, ("fixture-dsn",))
                        self.assertIn("statement_timeout=10000", kwargs["options"])
                    else:
                        self.assertEqual(kwargs["sslmode"], "require")
                        self.assertEqual(kwargs["host"], "fixture.invalid")


if __name__ == "__main__":
    unittest.main()
