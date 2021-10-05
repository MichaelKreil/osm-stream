#!/bin/bash
set -e
cd "$(dirname "$0")"

gzip -dc ../data/2_process/temp_way_refs1.txt.gz | sort -T ../temp/ | gzip -5 > ../data/2_process/temp_way_refs2.txt.gz
rm ../data/2_process/temp_way_refs1.txt.gz
