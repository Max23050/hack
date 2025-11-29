const GalacticBuf = require('../src/protocol/galactic-buf');
const assert = require('assert');

console.log("Testing GalacticBuf...");

// Test 1: Simple Object
const obj1 = {
    id: 123,
    name: "Test"
};
const buf1 = GalacticBuf.encode(obj1);
const decoded1 = GalacticBuf.decode(buf1);
assert.deepStrictEqual(decoded1, obj1);
console.log("Test 1 Passed: Simple Object");

// Test 2: Nested Object
const obj2 = {
    meta: {
        type: "nested",
        version: 1
    },
    data: "payload"
};
const buf2 = GalacticBuf.encode(obj2);
const decoded2 = GalacticBuf.decode(buf2);
assert.deepStrictEqual(decoded2, obj2);
console.log("Test 2 Passed: Nested Object");

// Test 3: List of Objects
const obj3 = {
    items: [
        { id: 1, val: "a" },
        { id: 2, val: "b" }
    ]
};
const buf3 = GalacticBuf.encode(obj3);
const decoded3 = GalacticBuf.decode(buf3);
assert.deepStrictEqual(decoded3, obj3);
console.log("Test 3 Passed: List of Objects");

// Test 4: Big Integers
const obj4 = {
    big: 9007199254740991 // MAX_SAFE_INTEGER
};
const buf4 = GalacticBuf.encode(obj4);
const decoded4 = GalacticBuf.decode(buf4);
assert.deepStrictEqual(decoded4, obj4);
console.log("Test 4 Passed: Big Integers");

console.log("All Protocol Tests Passed!");
