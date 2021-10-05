

wayid:9000000000,step:10000,nodeid:9000000000,lat:50.1234567,lng:50.1234567
9000000000,10000,9000000000,50.1234567,50.1234567
wwwwwssnnnnnllllllll




1.	parse pbf
	in: pbf
	out: bin_node = [node.id, lng, lat]
	out: bin_way_refs1 = [ref, ref index, way.id]
	out: geojson_node
	out: json_way
	out: json_relation
2. sort bin_way_refs1
	in: bin_way_refs1
	out: bin_way_refs2
	del: bin_way_refs1
3. stream merge node and way refs
	in: bin_node
	in: bin_way_refs2
	out: bin_way_nodes1 = [way.id, ref index, lng, lat]
	del: bin_node
	del: bin_way_refs2
4. sort bin_way_nodes1
	in: bin_way_nodes1
	out: bin_way_nodes2
	del: bin_way_nodes1
5. stream merge way nodes and ways
	in: json_way
	in: bin_way_nodes2
	out: geojson_way
	out: leveldb_way = [way.id, path]
	del: json_way
	del: bin_way_nodes2
6. finish relations
	in: json_relation
	in: leveldb_way
	out geojson_relation

