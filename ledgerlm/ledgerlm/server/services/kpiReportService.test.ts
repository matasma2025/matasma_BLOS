import assert from "node:assert/strict";
import test from "node:test";

const cubeId = "c71365af-3938-4e95-83ea-cad0b810f45e";
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

function assertClose(actual: number | null, expected: number, label: string) {
  assert.notEqual(actual, null, `${label} should have a value`);
  assert.ok(
    Math.abs(actual! - expected) < 0.01,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

test(
  "July 2026 KPI revenue and capacity match the reference snapshot",
  { skip: !hasDatabaseUrl },
  async () => {
    const { runKpiReport } = await import("./kpiReportService");
    const report = await runKpiReport({
      cubeId,
      year: 2026,
      month: 7,
      forecastScenario: "YTD Forecast",
    });

    const expected = {
      "World Wide": {
        revenue: [915.895123866427, 892.30319466901],
        capacity: [31541.622564102563, 31440.766286446044],
        capacityBreakdowns: {
          MS: [20088.24823977824, 20200.88962032416],
          MM: [1870.5443243243244, 1843.106666666666],
          SDS: [2158.51, 2070.9999994680284],
          "MS-External": [null, 221.66999999910587],
          "Integrated Service": [7141.5, 7030.099999988079],
        },
      },
      India: {
        revenue: [742.50977489, 721.8717164560161],
        capacity: [26568.578031430934, 26352.96795308648],
        capacityBreakdowns: {
          MS: [16948.913384525964, 17003.247953609807],
          MM: [1428.3188404533566, 1403.8099999999993],
          SDS: [1947.8, 1850.7399994775653],
          "MS-External": [null, 219.66999999910587],
          "Integrated Service": [5960.725806451613, 5801.5],
        },
      },
      Vietnam: {
        revenue: [112.44842249552451, 111.87030025172302],
        capacity: [4033.907435897436, 4126.438333359559],
        capacityBreakdowns: {
          MS: [2504.167435897436, 2536.2816667143497],
          MM: [243.81, 273.2966666666666],
          SDS: [110.93, 88.25999999046326],
          "MS-External": [null, 0],
          "Integrated Service": [1175, 1228.5999999880792],
        },
      },
      Mexico: {
        revenue: [29.89181187, 28.831392905162673],
        capacity: [634.75, 627],
        capacityBreakdowns: {
          MS: [454.49, 464],
          MM: [160.48, 136],
          SDS: [21.78, 27],
          "MS-External": [null, 0],
          "Integrated Service": [null, 0],
        },
      },
    } as const;

    for (const [entity, values] of Object.entries(expected)) {
      const scope = report.scopeBadges.find((item) => item.label === entity);
      assert.ok(scope, `missing report scope: ${entity}`);

      const revenue = scope.metrics.find((metric) => metric.id === "revenue");
      const capacity = scope.metrics.find((metric) => metric.id === "capacity");
      assert.ok(revenue, `missing revenue metric for ${entity}`);
      assert.ok(capacity, `missing capacity metric for ${entity}`);

      assertClose(revenue.actual, values.revenue[0], `${entity} actual revenue`);
      assertClose(revenue.forecast, values.revenue[1], `${entity} forecast revenue`);
      assertClose(capacity.actual, values.capacity[0], `${entity} actual capacity`);
      assertClose(capacity.forecast, values.capacity[1], `${entity} forecast capacity`);

      for (const [breakdown, [actual, forecast]] of Object.entries(values.capacityBreakdowns)) {
        const result = capacity.breakdowns?.find((item) => item.label === breakdown);
        assert.ok(result, `missing ${breakdown} capacity for ${entity}`);
        if (actual === null) {
          assert.equal(result.actual, null, `${entity} ${breakdown} actual capacity`);
        } else {
          assertClose(result.actual, actual, `${entity} ${breakdown} actual capacity`);
        }
        assertClose(result.forecast, forecast, `${entity} ${breakdown} forecast capacity`);
      }
    }
  },
);