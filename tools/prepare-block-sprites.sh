#!/usr/bin/env bash
set -euo pipefail

# Extract only each supplied block's visible artwork. Keep the 20 originals
# untouched so the source sheet can be reprocessed losslessly if needed.
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
input_dir="$project_dir/assets/sprites/gaia-blocks-v1"
output_dir="$input_dir/trimmed"
mkdir -p "$output_dir"

count=0
for input_file in "$input_dir"/*.png; do
  filename="${input_file##*/}"
  # A small alpha cutoff is used to FIND the bounding rectangle only; crop
  # preserves the original semitransparent highlights and antialiasing.
  bounds="$(convert "$input_file" -alpha extract -threshold 8% -format '%@' info:)"
  if [[ ! "$bounds" =~ ^[0-9]+x[0-9]+\+[0-9]+\+[0-9]+$ ]]; then
    echo "Invalid visible bounds: $filename ($bounds)" >&2
    exit 1
  fi
  convert "$input_file" -crop "$bounds" +repage "$output_dir/$filename"
  ((count+=1))
done

if [[ $count -ne 20 ]]; then
  echo "Expected all 20 block sprites, found $count" >&2
  exit 1
fi
echo "Prepared $count transparent block sprites in $output_dir"
