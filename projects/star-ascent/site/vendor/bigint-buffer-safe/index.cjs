'use strict';

const asBytes = (value, name) => {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${name} must be a Buffer or Uint8Array`);
  }
  return Buffer.from(value);
};

const asUnsignedBigInt = (value) => {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new TypeError('num must be a non-negative bigint');
  }
  return value;
};

const asWidth = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('width must be a non-negative safe integer');
  }
  return value;
};

const bigintFromHex = (hex) => (hex.length === 0 ? 0n : BigInt(`0x${hex}`));

function toBigIntLE(input) {
  const bytes = asBytes(input, 'buf');
  bytes.reverse();
  return bigintFromHex(bytes.toString('hex'));
}

function toBigIntBE(input) {
  return bigintFromHex(asBytes(input, 'buf').toString('hex'));
}

function toBufferBE(value, requestedWidth) {
  const num = asUnsignedBigInt(value);
  const width = asWidth(requestedWidth);
  if (width === 0) {
    if (num !== 0n) throw new RangeError('num does not fit in width');
    return Buffer.alloc(0);
  }
  const unpadded = num.toString(16);
  if (unpadded.length > width * 2) {
    throw new RangeError('num does not fit in width');
  }
  const hex = unpadded.padStart(width * 2, '0');
  return Buffer.from(hex, 'hex');
}

function toBufferLE(value, requestedWidth) {
  const bytes = toBufferBE(value, requestedWidth);
  bytes.reverse();
  return bytes;
}

module.exports = {
  toBigIntBE,
  toBigIntLE,
  toBufferBE,
  toBufferLE,
};
