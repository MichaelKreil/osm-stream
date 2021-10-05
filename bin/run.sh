#!/bin/bash
set -e
cd "$(dirname "$0")"

time node 1_parse_pbf.js
time bash 2_sort_way_refs.sh
time node 3_merge_nodes_into_wayrefs.js
time bash 4_sort_way_nodes.sh
time node 5_generate_paths.js
