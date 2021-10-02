"use strict"

const b4 = 0x100000000;

Buffer.prototype.writeUInt40LE = function writeUInt40LE(value, offset = 0) {
	offset = this.writeUInt32LE(value % b4, offset);
	return this.writeUInt8(Math.floor(value/b4), offset);
}

Buffer.prototype.writeUInt48LE = function writeUInt48LE(value, offset = 0) {
	offset = this.writeUInt32LE(value % b4, offset);
	return this.writeUInt16LE(Math.floor(value/b4), offset);
}

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
			bytes.writeUInt40LE(v,0);
			return bytes;
		}
		case 6: return v => {
			let bytes = Buffer.allocUnsafe(6);
			bytes.writeUInt48LE(v,0);
			return bytes;
		}
	}
	throw Error();
}

function ArrayInt2Buf(byteCount) {
	switch (byteCount) {
		case 4: return a => {
			let index = 0, bytes = Buffer.allocUnsafe(4*a.length);
			a.forEach(v => index = bytes.writeUInt32LE(v, index));
			return bytes;
		}
		case 5: return a => {
			let index = 0, bytes = Buffer.allocUnsafe(5*a.length);
			a.forEach(v => index = bytes.writeUInt40LE(v, index));
			return bytes;
		}
		case 6: return a => {
			let index = 0, bytes = Buffer.allocUnsafe(6*a.length);
			a.forEach(v => index = bytes.writeUInt48LE(v, index));
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
			let n = Math.round(buf.length / 4), ints = new Array(n);
			for (let i = 0; i < n; i++) ints[i] = buf.readUInt32LE(i*4);
			return ints;
		}
	}
	throw Error();
}