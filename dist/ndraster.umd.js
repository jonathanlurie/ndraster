(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.ndraster = factory());
}(this, (function () { 'use strict';

  const DEFAULT = {
    dtype: 'float64',
    copy: false,
  };

  const DTYPE_TO_TYPEDARRAY_CONSTRUCTOR = {
    uint8: Uint8Array,
    int8: Int8Array,
    uint16: Uint16Array,
    int16: Int16Array,
    uint32: Uint32Array,
    int32: Int32Array,
    uint64: BigUint64Array,
    int64: BigInt64Array,
    float32: Float32Array,
    float64: Float64Array,
  };

  class NdRaster {
    /**
     * @constructor
     * @param {Array|Uint8Array|Int8Array|Uint16Array|Int16Array|Uint32Array|Int32Array|BigUint64Array|BigInt64Array|Float32Array|Float64Array} data - can be a generic Array or one of the typedArray.
     * If it is a generic Array, the values will be copied in a typed array (default dtype or dtype in the options object).
     * If it is a typed array, a reference will be used and the values will not be copied, unless `options.copy` is explicitelly set to true or `options.dtype` does not matchc the type of the provided data.
     * @param {Object} options - the options object
     * @param {string} options.dtype - the data type to enforce the data to be. Must be one of 'uint8', 'int8', 'uint16', 'int16', 'uint32', 'int32', 'uint64', 'int64', 'float32', 'float64' (default: 'float64')
     * @param {boolean} options.copy - if false, the inner data of the NdRaster instance will be a reference (unless another dtype is provided). If true, the data will be deep copied (default: false)
     * @param {Array} options.shape - the shape to provide to the data, important to interpret the data as a multi-dimensional dataset.
     *        Example: shape must be like [number, number, number] for a 3D matrix, where the first element is the size of the slowest dimension
     *                 and the last element is the size of the fastest dimension. Numpy refers to this as the 'C' order, in opposition to the 'F' (Fortran) order.
     *                 This order is also the default order used in Numpy.
     *                 (default: single dimension of the size of the provided array)
     */
    constructor(arr, options = {}) {
      const providedDtype = 'dtype' in options ? options.dtype : null;
      const copy = 'copy' in options ? (!!options.copy) : false;
      const shape = 'shape' in options ? options.shape : null;

      this.data = null;
      this.dtype = null;
      this.shape = null;
      this.strides = null;

      // if dtype provided in option but not valid, we throw an Error
      if (providedDtype && !NdRaster.isValidDtype(providedDtype)) {
        throw new Error(`The value ${providedDtype} is not a valid dtype.`)
      }

      const guessedDtype = NdRaster.guessDtype(arr);
      const dtypeToUse = providedDtype ? providedDtype : DEFAULT.dtype;
      const DtypeConstructor = DTYPE_TO_TYPEDARRAY_CONSTRUCTOR[dtypeToUse];

      if (NdRaster.isGenericArray(arr)
      || guessedDtype !== dtypeToUse
      || copy) {
        this.data = new DtypeConstructor(arr);
        this.dtype = dtypeToUse;
      } else if (guessedDtype) {
        this.data = new DtypeConstructor(arr);
        this.dtype = dtypeToUse;
      } else {
        throw new Error('The provided data array is not valid.')
      }

      if (shape) {
        this.setShape(shape);
      }
    }


    /**
     * Define the shape of the data.
     * @param {Array} shape - the shape to provide to the data, important to interpret the data as a multi-dimensional dataset.
     *        Example: shape must be like [number, number, number] for a 3D matrix, where the first element is the size of the slowest dimension
     *                 and the last element is the size of the fastest dimension. Numpy refers to this as the 'C' order, in opposition to the 'F' (Fortran) order.
     *                 This order is also the default order used in Numpy.
     *                 (default: single dimension of the size of the provided array)
     */
    setShape(shape) {
      let total = 1;

      if (!Array.isArray(shape)) {
        throw new Error('The shape must be an Array')
      }

      for (let i = 0; i < shape.length; i += 1) {
        total *= shape[i];
      }

      if (total !== this.data.length) {
        throw new Error('The shape does not match the size of the data. All the elements of the shape multiplied must be the total number of element in the data.')
      }

      this.shape = shape.slice();
      this.strides = new Array(shape.length).fill(0);
      this.strides[this.shape.length - 1] = 1;

      for (let i = this.shape.length - 2; i >= 0; i -= 1) {
        this.strides[i] = this.shape[i + 1] * this.strides[i + 1];
      }
    }


    /**
     * @static
     * Tells if a dtype is valid
     * @param {string} dtype - a dtype as a string
     * @returns {boolean}
     */
    static isValidDtype(dtype) {
      return dtype in DTYPE_TO_TYPEDARRAY_CONSTRUCTOR
    }


    /**
     * @static
     * Tells the dtype of the given array. If no dtype is found, `null`  is returned.
     * @param {*} arr - Some value that may or may not be a typed array
     * @returns {string|null}
     */
    static guessDtype(arr) {
      const dtypes = Object.keys(DTYPE_TO_TYPEDARRAY_CONSTRUCTOR);
      for (let i = 0; i < dtypes.length; i += 1) {
        const dtype = dtypes[i];
        if (arr instanceof DTYPE_TO_TYPEDARRAY_CONSTRUCTOR[dtype]) {
          return dtype
        }
      }
      return null
    }


    /**
     * @static
     * Tells if a value is of type Array.
     * Note: this function will return false if the value is a typed array
     * @param {*} arr
     */
    static isGenericArray(arr) {
      return (arr instanceof Array)
    }
  }

  var index = ({
    NdRaster,
  });

  return index;

})));
//# sourceMappingURL=ndraster.umd.js.map
