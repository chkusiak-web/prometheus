"""Build Prometheus's static USDA FoodData Central search files from release ZIPs."""
import argparse
from collections import defaultdict
from datetime import datetime
import json
from pathlib import Path
import re
from zipfile import ZipFile

NUTRIENTS = (1008, 1003, 1005, 1004)
WORD = re.compile(r"[a-z0-9]+")
BARCODE = re.compile(r"\d{8}|\d{12,14}")


def food_rows(path, group):
    with ZipFile(path) as archive:
        member = next(name for name in archive.namelist() if name.endswith(".json"))
        with archive.open(member) as data:
            if group == "SurveyFoods":
                yield from json.load(data)[group]
                return
            # USDA's branded export has one object per line. Stream the 3 GB JSON.
            if data.readline().strip() != b'{"BrandedFoods": [':
                raise ValueError("Unexpected USDA branded archive format")
            decoder = json.JSONDecoder()
            for line in data:
                entry = line.strip().rstrip(b",")
                if entry in (b"]}", b"]", b"}", b""):
                    continue
                line_text = entry.decode("utf-8")
                food, end = decoder.raw_decode(line_text)
                if line_text[end:].strip() not in ("", "]}"):
                    raise ValueError("Unexpected text after USDA branded record")
                yield food


def nutrition(food):
    amounts = {item["nutrient"]["id"]: item.get("amount")
               for item in food.get("foodNutrients", []) if item.get("nutrient")}
    values = [amounts.get(key) for key in NUTRIENTS]
    if all(isinstance(value, (int, float)) and value >= 0 for value in values):
        return values
    return None


def survey_row(food):
    values = nutrition(food)
    if values is None:
        return None
    portions = [p for p in food.get("foodPortions", [])
                if p.get("gramWeight", 0) > 0 and p.get("portionDescription")]
    preferred = min(portions, key=lambda p: p.get("sequenceNumber", 999), default=None)
    label = preferred["portionDescription"] if preferred else "100 g"
    grams = preferred["gramWeight"] if preferred else 100
    return [food["description"], *values, label, grams]


def branded_row(food):
    if food.get("marketCountry") != "United States":
        return None
    values = nutrition(food)
    size, unit = food.get("servingSize"), str(food.get("servingSizeUnit", "")).lower()
    if values is None or not isinstance(size, (float, int)) or size <= 0 or unit not in ("g", "ml"):
        return None
    title = food["description"].strip()
    brand = (food.get("brandName") or food.get("brandOwner") or "").strip()
    if brand and brand.casefold() not in title.casefold():
        title = f"{brand} · {title}"
    label = (food.get("householdServingFullText") or "").strip() or f"{size:g} {unit}"
    return [title, *values, label, size] if unit == "g" else [title, *values, label, 0, size]


def words(name):
    return WORD.findall(re.sub(r"\boat[-\s]*milk\b", "oat milk", name.lower()))


def write_json(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def build(survey_zip, branded_zip, output):
    survey = [row for food in food_rows(survey_zip, "SurveyFoods") if (row := survey_row(food))]
    write_json(output / "survey.json", survey)

    products = {}
    for food in food_rows(branded_zip, "BrandedFoods"):
        if food.get("marketCountry") != "United States":
            continue
        row = branded_row(food)
        barcode = str(food.get("gtinUpc") or "")
        code = barcode.lstrip("0") if BARCODE.fullmatch(barcode) else ""
        key = code or ((row[0].casefold(), row[5]) if row else None)
        if not key:
            continue
        date = food.get("publicationDate") or "01/01/1900"
        version = (datetime.strptime(date, "%m/%d/%Y"), food["fdcId"])
        if key not in products or version > products[key][0]:
            products[key] = (version, None if food.get("discontinuedDate") else row)

    search = defaultdict(list)
    barcodes = defaultdict(dict)
    for key, (_, row) in products.items():
        if row is None:
            continue
        for prefix in {word[:3] for word in words(row[0]) if len(word) >= 3}:
            search[prefix].append(row)
        if isinstance(key, str):
            barcodes[key[:3]][key] = row

    for key, rows in search.items():
        write_json(output / "search" / f"{key}.json", rows)
    for key, rows in barcodes.items():
        write_json(output / "barcode" / f"{key}.json", rows)
    print(f"{len(survey):,} survey foods, {sum(row is not None for _, row in products.values()):,} branded foods, "
          f"{sum(map(len, barcodes.values())):,} UPC/GTIN records")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("survey_zip", type=Path)
    parser.add_argument("branded_zip", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.survey_zip, args.branded_zip, args.output)
