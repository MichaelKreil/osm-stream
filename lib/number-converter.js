"use strict"

const b1 = 0x100;
const b2 = 0x10000;
const b3 = 0x1000000;
const b4 = 0x100000000;

module.exports = {
	Int2Buf,
	Buf2Int,
	ArrayInt2Buf,
	ArrayBuf2Int,
}

function Int2Buf(byteCount) {
	switch (byteCount) {
		case 4: return v => {
			let bytes = Buffer.allocUnsafe(4);
			bytes.writeUInt32LE(v,0);
			return bytes;
		}
		case 5: return v => {
			let bytes = Buffer.allocUnsafe(5);
			bytes.writeUInt32LE(v % b4,0);
			v = Math.floor(v/b4);
			bytes.writeUInt8(v,4);
			return bytes;
		}
		case 6: return v => {
			console.log('v', v);
			let bytes = Buffer.allocUnsafe(6);
			bytes.writeUInt32LE(v % b4,0);
			v = Math.floor(v/b4);
			bytes.writeUInt16LE(v,4);
			return bytes;
		}
	}
	throw Error();
}

function ArrayInt2Buf(byteCount) {
	switch (byteCount) {
		case 4: return a => {
			let bytes = Buffer.allocUnsafe(4*a.length);
			let index = 0;
			a.forEach(v => {
				index = bytes.writeUInt32LE(v,index)
			});
			return bytes;
		}
		case 5: return a => {
			let bytes = Buffer.allocUnsafe(5*a.length);
			let index = 0;
			a.forEach(v => {
				index = bytes.writeUInt32LE(v % b4, index);
				v = Math.floor(v/b4);
				index = bytes.writeUInt8(v, index);
			});
			return bytes;
		}
		case 6: return a => {
			let bytes = Buffer.allocUnsafe(6*a.length);
			let index = 0;
			a.forEach(v => {
				index = bytes.writeUInt32LE(v % b4, index);
				v = Math.floor(v/b4);
				index = bytes.writeUInt16LE(v, index);
			});
			return bytes;
		}
	}
}

function Buf2Int(byteCount) {
	throw Error();
}

function ArrayBuf2Int(byteCount) {
	switch (byteCount) {
		case 4: return buf => {
			let n = buf.length >>> 2;
			let ints = new Array(n);
			for (let i = 0; i < n; i++) ints[i] = buf.readUInt32LE(i*4);
			return ints;
		}
	}
	throw Error();
}