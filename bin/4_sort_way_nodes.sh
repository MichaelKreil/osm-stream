#!/bin/bash
set -e
cd "$(dirname "$0")"

rm ../data/2_process/temp_nodes.txt.gz
rm ../data/2_process/temp_way_refs2.txt.gz
gzip -dc ../data/2_process/temp_way_nodes1.txt.gz | sort -T ../temp/ | gzip -5 > ../data/2_process/temp_way_nodes2.txt.gz
rm ../data/2_process/temp_way_nodes1.txt.gz
