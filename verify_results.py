"""Reconcile the frozen field predictions and reproduce the reported counts, offline."""
import csv
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def read_file(name):
    with (ROOT / name).open(encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def keyed(name):
    rows = read_file(name)
    by_id = {row["id"]: row for row in rows}
    if len(rows) != len(by_id):
        raise ValueError(f"Duplicate photo ID in {name}")
    return by_id


def check(condition, message):
    if not condition:
        raise ValueError(message)


def main():
    actual = hashlib.sha256((ROOT / "cloud-predictions.csv").read_bytes()).hexdigest()
    check(actual == "294a055cb9eba34e97af8d8939abc0a790a77fe528b6a8323b18924401f25053", "Cloud predictions changed")
    answers = keyed("blind32.csv")
    cloud = keyed("cloud-predictions.csv")
    old, new = keyed("mac-r6.csv"), keyed("mac-r8.csv")
    check(len(answers) == 32 and answers.keys() == cloud.keys() == old.keys() == new.keys(), "Missing or extra records")
    for key, row in answers.items():
        c = cloud[key]
        check(row["sha256"] == c["sha256"] == old[key]["sha256"] == new[key]["sha256"], key)
        for prefix, local, status_col, action_col in (("r6", old, "prior", "r6_action"), ("protected", new, "status", "action")):
            check(c[prefix+"_status"] == local[key]["status"] == row[status_col], key)
            check(c[prefix+"_action"] == local[key]["action"] == row[action_col], key)
    rows = list(answers.values())
    for col in ("prior", "status"):
        cows = [r for r in rows if r["gold"] == "cattle"]
        negatives = [r for r in rows if r["gold"] == "non_cattle"]
        print(col, "correct", sum(r[col] == r["gold"] for r in rows), "/", len(rows),
              "cattle passed", sum(r[col] == "cattle" for r in cows), "/", len(cows),
              "non-cattle rejected", sum(r[col] == "non_cattle" for r in negatives), "/", len(negatives),
              "non-cattle passed", sum(r[col] == "cattle" for r in negatives),
              "cattle rejected", sum(r[col] == "non_cattle" for r in cows))
    historical = read_file("historical-1354.csv")
    check(len(historical) == len({r["sha256"] for r in historical}) == 1354, "Historical roster differs")
    gain = sum(r["prior"] != r["gold"] and r["status"] == r["gold"] for r in historical)
    loss = sum(r["prior"] == r["gold"] and r["status"] != r["gold"] for r in historical)
    protected = [r for r in historical if r["protected50"] == "True"]
    print("historical", len(historical), "gain", gain, "loss", loss, "protected cattle passed",
          sum(r["status"] == r["gold"] == "cattle" for r in protected), "/", len(protected))


if __name__ == "__main__":
    main()
