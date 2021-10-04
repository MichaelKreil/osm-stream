

wayid:9000000000,step:10000,nodeid:9000000000,lat:50.1234567,lng:50.1234567
9000000000,10000,9000000000,50.1234567,50.1234567
wwwwwssnnnnnllllllll




1.	parse pbf
	in: pbf
	out: bin_node = [node.id, lng, lat]
	out: bin_way1 = [node.id, node index, way.id]
	out: geojson_node
	out: json_way
	out: json_relation
2. sort bin_way1
	in: bin_way1
	out: bin_way2
	del: bin_way1
3. stream merge node and way nodes
	in: bin_node
	in: bin_way2
	out: bin_way3 = [way.id, node index, lng, lat]
	del: bin_node
	del: bin_way2
4. sort bin_way3
	in: bin_way3
	out: bin_way4
	del: bin_way3
5. stream merge way nodes and ways
	in: json_way
	in: bin_way4
	out: geojson_way
	out: leveldb_way = [way.id, path]
	del: json_way
	del: bin_way4
6. finish relations
	in: json_relation
	in: leveldb_way
	out geojson_relation

