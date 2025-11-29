const PROTOCOL_VERSION = 0x01;

const TYPES = {
    INTEGER: 0x01,
    STRING: 0x02,
    LIST: 0x03,
    OBJECT: 0x04
};

class GalacticBuf {
    /**
     * Encodes a JS Object into a Buffer
     * @param {Object} obj 
     * @returns {Buffer}
     */
    static encode(obj) {
        // The top-level object must be encoded with the Protocol Header
        // Header: [Version (1)][Field Count (1)][Total Length (2)]
        
        const fields = Object.entries(obj);
        const fieldCount = fields.length;
        
        if (fieldCount > 255) {
            throw new Error("Too many fields for GalacticBuf (max 255)");
        }

        const fieldBuffers = [];
        for (const [key, value] of fields) {
            fieldBuffers.push(this._encodeField(key, value));
        }

        const contentBuffer = Buffer.concat(fieldBuffers);
        
        // Header is 4 bytes
        const totalLength = 4 + contentBuffer.length;
        
        const header = Buffer.alloc(4);
        header.writeUInt8(PROTOCOL_VERSION, 0);
        header.writeUInt8(fieldCount, 1);
        header.writeUInt16BE(totalLength, 2);

        return Buffer.concat([header, contentBuffer]);
    }

    static _encodeField(name, value) {
        const nameBuffer = Buffer.from(name, 'utf8');
        if (nameBuffer.length > 255) {
            throw new Error(`Field name too long: ${name}`);
        }

        const metaBuffer = Buffer.alloc(1 + nameBuffer.length + 1);
        metaBuffer.writeUInt8(nameBuffer.length, 0);
        nameBuffer.copy(metaBuffer, 1);
        
        let type;
        let valueBuffer;

        if (typeof value === 'number' || typeof value === 'bigint') {
            // Spec says 64-bit signed Big-Endian
            type = TYPES.INTEGER;
            valueBuffer = Buffer.alloc(8);
            valueBuffer.writeBigInt64BE(BigInt(value), 0);
        } else if (typeof value === 'string') {
            type = TYPES.STRING;
            const strBytes = Buffer.from(value, 'utf8');
            valueBuffer = Buffer.alloc(2 + strBytes.length);
            valueBuffer.writeUInt16BE(strBytes.length, 0);
            strBytes.copy(valueBuffer, 2);
        } else if (Array.isArray(value)) {
            type = TYPES.LIST;
            valueBuffer = this._encodeList(value);
        } else if (typeof value === 'object' && value !== null) {
            type = TYPES.OBJECT;
            valueBuffer = this._encodeObject(value);
        } else {
            throw new Error(`Unsupported type for field: ${name}`);
        }

        metaBuffer.writeUInt8(type, 1 + nameBuffer.length);
        
        return Buffer.concat([metaBuffer, valueBuffer]);
    }

    static _encodeList(list) {
        if (list.length === 0) {
            // Empty list - default to String type or handle specifically? 
            // Spec says "Homogeneous". If empty, type doesn't matter much, let's assume String (0x02) or just 0x00?
            // Let's default to Integer (0x01) for safety if unknown.
            const buf = Buffer.alloc(3);
            buf.writeUInt8(TYPES.INTEGER, 0); // Element Type
            buf.writeUInt16BE(0, 1); // Count
            return buf;
        }

        // Determine type from first element
        const first = list[0];
        let elementType;
        if (typeof first === 'number' || typeof first === 'bigint') elementType = TYPES.INTEGER;
        else if (typeof first === 'string') elementType = TYPES.STRING;
        else if (Array.isArray(first)) throw new Error("Nested lists not supported in this simple impl"); // Spec doesn't explicitly forbid, but let's keep simple
        else if (typeof first === 'object') elementType = TYPES.OBJECT;
        else throw new Error("Unsupported list element type");

        const elementBuffers = [];
        for (const item of list) {
            if (elementType === TYPES.INTEGER) {
                const b = Buffer.alloc(8);
                b.writeBigInt64BE(BigInt(item), 0);
                elementBuffers.push(b);
            } else if (elementType === TYPES.STRING) {
                const strBytes = Buffer.from(item, 'utf8');
                const b = Buffer.alloc(2 + strBytes.length);
                b.writeUInt16BE(strBytes.length, 0);
                strBytes.copy(b, 2);
                elementBuffers.push(b);
            } else if (elementType === TYPES.OBJECT) {
                elementBuffers.push(this._encodeObject(item));
            }
        }

        const header = Buffer.alloc(3);
        header.writeUInt8(elementType, 0);
        header.writeUInt16BE(list.length, 1);

        return Buffer.concat([header, ...elementBuffers]);
    }

    static _encodeObject(obj) {
        // Nested object: [Field Count (1 byte)][Field 1]...[Field N]
        // No 4-byte Protocol Header
        const fields = Object.entries(obj);
        const fieldCount = fields.length;
        const fieldBuffers = [];
        
        for (const [key, value] of fields) {
            fieldBuffers.push(this._encodeField(key, value));
        }
        
        const header = Buffer.alloc(1);
        header.writeUInt8(fieldCount, 0);
        
        return Buffer.concat([header, ...fieldBuffers]);
    }

    /**
     * Decodes a Buffer into a JS Object
     * @param {Buffer} buffer 
     * @returns {Object}
     */
    static decode(buffer) {
        if (buffer.length < 4) {
            throw new Error("Buffer too short for header");
        }

        const version = buffer.readUInt8(0);
        if (version !== PROTOCOL_VERSION) {
            throw new Error(`Unsupported protocol version: ${version}`);
        }

        const fieldCount = buffer.readUInt8(1);
        const totalLength = buffer.readUInt16BE(2);

        if (buffer.length < totalLength) {
            throw new Error(`Incomplete message. Expected ${totalLength}, got ${buffer.length}`);
        }

        const { result } = this._decodeFields(buffer, 4, fieldCount);
        return result;
    }

    static _decodeFields(buffer, offset, count) {
        const result = {};
        let currentOffset = offset;

        for (let i = 0; i < count; i++) {
            // Name Len
            const nameLen = buffer.readUInt8(currentOffset);
            currentOffset += 1;

            // Name
            const name = buffer.toString('utf8', currentOffset, currentOffset + nameLen);
            currentOffset += nameLen;

            // Type
            const type = buffer.readUInt8(currentOffset);
            currentOffset += 1;

            // Value
            let value;
            if (type === TYPES.INTEGER) {
                value = buffer.readBigInt64BE(currentOffset);
                // Convert BigInt to Number if safe, or keep as BigInt? 
                // JS Numbers are doubles. 64-bit ints might overflow. 
                // For this hackathon, prices/quantities fit in Number. Timestamps fit in Number (up to 2^53).
                // Let's convert to Number for ease of use, but be aware.
                if (value <= Number.MAX_SAFE_INTEGER && value >= Number.MIN_SAFE_INTEGER) {
                    value = Number(value);
                }
                currentOffset += 8;
            } else if (type === TYPES.STRING) {
                const len = buffer.readUInt16BE(currentOffset);
                currentOffset += 2;
                value = buffer.toString('utf8', currentOffset, currentOffset + len);
                currentOffset += len;
            } else if (type === TYPES.LIST) {
                const { list, newOffset } = this._decodeList(buffer, currentOffset);
                value = list;
                currentOffset = newOffset;
            } else if (type === TYPES.OBJECT) {
                const { obj, newOffset } = this._decodeObject(buffer, currentOffset);
                value = obj;
                currentOffset = newOffset;
            } else {
                throw new Error(`Unknown type: ${type}`);
            }

            result[name] = value;
        }

        return { result, newOffset: currentOffset };
    }

    static _decodeList(buffer, offset) {
        let currentOffset = offset;
        const elementType = buffer.readUInt8(currentOffset);
        currentOffset += 1;
        
        const count = buffer.readUInt16BE(currentOffset);
        currentOffset += 2;

        const list = [];
        for (let i = 0; i < count; i++) {
            if (elementType === TYPES.INTEGER) {
                let val = buffer.readBigInt64BE(currentOffset);
                if (val <= Number.MAX_SAFE_INTEGER && val >= Number.MIN_SAFE_INTEGER) {
                    val = Number(val);
                }
                list.push(val);
                currentOffset += 8;
            } else if (elementType === TYPES.STRING) {
                const len = buffer.readUInt16BE(currentOffset);
                currentOffset += 2;
                list.push(buffer.toString('utf8', currentOffset, currentOffset + len));
                currentOffset += len;
            } else if (elementType === TYPES.OBJECT) {
                const { obj, newOffset } = this._decodeObject(buffer, currentOffset);
                list.push(obj);
                currentOffset = newOffset;
            }
        }
        return { list, newOffset: currentOffset };
    }

    static _decodeObject(buffer, offset) {
        let currentOffset = offset;
        const fieldCount = buffer.readUInt8(currentOffset);
        currentOffset += 1;
        
        const { result, newOffset } = this._decodeFields(buffer, currentOffset, fieldCount);
        return { obj: result, newOffset };
    }
}

module.exports = GalacticBuf;
