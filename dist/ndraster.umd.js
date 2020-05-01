(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.ndraster = factory());
}(this, (function () { 'use strict';

  /* global BigUint64Array, BigInt64Array */
  /* eslint no-undef: "error" */

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

  const DTYPE_TO_NB_POSIBLE_VALUES = {
    uint8: 2 ** (Uint8Array.BYTES_PER_ELEMENT * 8),
    int8: 2 ** (Int8Array.BYTES_PER_ELEMENT * 8),
    uint16: 2 ** (Uint16Array.BYTES_PER_ELEMENT * 8),
    int16: 2 ** (Int16Array.BYTES_PER_ELEMENT * 8),
    uint32: 2 ** (Uint32Array.BYTES_PER_ELEMENT * 8),
    int32: 2 ** (Int32Array.BYTES_PER_ELEMENT * 8),
    uint64: 2 ** (BigUint64Array.BYTES_PER_ELEMENT * 8),
    int64: 2 ** (BigInt64Array.BYTES_PER_ELEMENT * 8),
    float32: Infinity,
    float64: Infinity,
  };

  const DTYPE_TO_BOUND = {
    uint8: {
      min: 0,
      max: DTYPE_TO_NB_POSIBLE_VALUES.uint8 - 1,
    },
    int8: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.int8 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.int8 / 2 - 1,
    },
    uint16: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.uint16 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.uint16 / 2 - 1,
    },
    int16: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.int16 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.int16 / 2 - 1,
    },
    uint32: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.uint32 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.uint32 / 2 - 1,
    },
    int32: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.int32 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.int32 / 2 - 1,
    },
    uint64: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.uint64 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.uint64 / 2 - 1,
    },
    int64: {
      min: -DTYPE_TO_NB_POSIBLE_VALUES.int64 / 2,
      max: DTYPE_TO_NB_POSIBLE_VALUES.int64 / 2 - 1,
    },
    float32: {
      min: -Infinity,
      max: Infinity,
    },
    float64: {
      min: -Infinity,
      max: +Infinity,
    },
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
      let shape = 'shape' in options ? options.shape : null;

      this._data = null;
      this._dtype = null;
      this._shape = null;
      this._strides = null;

      // if dtype provided in option but not valid, we throw an Error
      if (providedDtype && !NdRaster.isValidDtype(providedDtype)) {
        throw new Error(`The value ${providedDtype} is not a valid dtype.`)
      }

      const guessedDtype = NdRaster.guessDtype(arr);
      const dtypeToUse = providedDtype ? providedDtype : DEFAULT.dtype;
      const isGenericArray = NdRaster.isGenericArray(arr);

      if (isGenericArray
      || (guessedDtype !== dtypeToUse && providedDtype)
      || copy) {
        let arrData = arr;

        // if a generic Array is provided, it could be a nested array
        if (isGenericArray) {
          const arrConfig = NdRaster.flattenNestedArray(arr);
          arrData = arrConfig.array;

          // if no shape is provided, then we use the shape deduced by the flattening
          if (!shape) {
            shape = arrConfig.shape;
          }
        }

        this._data = NdRaster.copyDataAsType(arrData, dtypeToUse);
        this._dtype = dtypeToUse;
      } else if (guessedDtype && copy) { // the type could be guessed but it was explicitely expressed to copy
        this._data = NdRaster.copyDataAsType(arr, guessedDtype);
        this._dtype = dtypeToUse;
      } else if (guessedDtype && !copy) { // the type could be guessed and it was not express to copy, we just assign
        this._data = arr;
        this._dtype = guessedDtype;
      } else {
        throw new Error('The provided data array is not valid.')
      }

      if (shape) {
        this.shape = shape;
      } else {
        this.shape = [this._data.length];
      }

      this._typeBound = DTYPE_TO_BOUND[this._dtype];
    }


    /**
     * Define the shape of the data.
     * @param {Array} shape - the shape to provide to the data, important to interpret the data as a multi-dimensional dataset.
     *        Example: shape must be like [number, number, number] for a 3D matrix, where the first element is the size of the slowest dimension
     *                 and the last element is the size of the fastest dimension. Numpy refers to this as the 'C' order, in opposition to the 'F' (Fortran) order.
     *                 This order is also the default order used in Numpy.
     *                 (default: single dimension of the size of the provided array)
     */
    set shape(shape) {
      let total = 1;

      if (!Array.isArray(shape)) {
        throw new Error('The shape must be an Array')
      }

      for (let i = 0; i < shape.length; i += 1) {
        total *= shape[i];
      }

      if (total !== this._data.length) {
        throw new Error('The shape does not match the size of the data. All the elements of the shape multiplied must be the total number of element in the data.')
      }

      this._shape = shape.slice();
      this._strides = new Array(shape.length).fill(0);
      this._strides[this._shape.length - 1] = 1;

      for (let i = this._shape.length - 2; i >= 0; i -= 1) {
        this._strides[i] = this._shape[i + 1] * this._strides[i + 1];
      }
    }


    /**
     * Get the shape of this NdRaster (or rather a copy of it)
     * @returns {Array}
     */
    get shape() {
      return this._shape.slice()
    }


    /**
     * Get the dtype as a string (read only)
     * @returns {string}
     */
    get dtype() {
      return this._dtype
    }


    /**
     * Get the stride (read only)
     */
    get strides() {
      return this._strides.slice()
    }


    /**
     * Get the raw data as a 1D typed array with data arranged in 'C' order
     * @returns {TYpedArray}
     */
    get data() {
      return this._data
    }


    /**
     * Get the minimum and maximum values possible by the dtype.
     * Note: this is not the data min-max
     * @return {Object} of shape {min: number, max: number}
     */
    get bounds() {
      // making it read only to prevent any modification
      return {
        min: this._typeBound.min,
        max: this._typeBound.max,
      }
    }


    /**
     * Get the number of dimensions in this NdRaster
     * @returns {number}
     */
    get dimensions() {
      return this._shape.length
    }


    /**
     * Get the value at a given position
     * @param {Array} position - the position as [number, number, ...] with as many components as there are dimensions in the NdRaster.
     * @returns {number}
     */
    get(position) {
      this._throwIfInvalidPosition(position);

      let dataOffset = 0;
      for (let i = 0; i < position.length; i += 1) {
        dataOffset += position[i] * this._strides[i];
      }

      return this._data[dataOffset]
    }


    /**
     * Set the value at a given position.
     * This value is bounded to the dtype capabilities to prevent looping,
     * for example, is dtype is 'uint8' and a value is set at 300, then the actual
     * value put in the NdRaster will be 255, as it is the maximum value possible for 'uint8' type.
     * Know more about the boudaries for this NdRaster with the attribute `.bounds`
     * @param {Array} position - position to change to change the value of. Must contain as many elements as there are dimensions in this NdRaster
     * @param {number} value
     */
    set(position, value) {
      // eslint-disable-next-line no-restricted-globals
      if (isNaN(value)) {
        throw new Error('The value must be a number')
      }

      this._throwIfInvalidPosition(position);

      let boundedValue = value;
      let dataOffset = 0;

      if (value < this._typeBound.min) {
        boundedValue = this._typeBound.min;
      }

      if (value > this._typeBound.max) {
        boundedValue = this._typeBound.max;
      }

      for (let i = 0; i < position.length; i += 1) {
        dataOffset += position[i] * this._strides[i];
      }

      this._data[dataOffset] = boundedValue;
    }





    /**
     * @private
     * Throw an error if position is invalid.
     * @param {*} position
     */
    _throwIfInvalidPosition(position) {
      if (position.length !== this._shape.length) {
        throw new Error(`The position argument contains ${position.length} elements instead of ${this._shape.length}.`)
      }

      for (let i = 0; i < position.length; i += 1) {
        if (position[i] < 0 || position[i] > this._shape[i] - 1) {
          throw new Error(`The position components ${i} is out of bound. Must be in [0, ${this._shape[i] - 1}]`)
        }
      }
    }


    copy(options = {}) {
      const dtype = 'dtype' in options ? options.dtype : this._dtype;

      if (!(dtype in DTYPE_TO_TYPEDARRAY_CONSTRUCTOR)) {
        throw new Error('The provided dtype is not valid')
      }

      let dataCopy = null;
      if (dtype === this._dtype) {
        dataCopy = this._data.slice();
      } else {
        dataCopy = NdRaster.copyDataAsType(this._data, dtype);
      }

      const copy = new NdRaster(dataCopy, {
        copy: false,
        shape: this.shape,
      });
      return copy
    }


    /**
     * 
     * @param {*} start 
     * @param {*} end 
     */
    slice(start, end) {

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


    /**
     * @static
     * Get the shape of a nested array. A nested array is a generic Array that contains other arrays
     * such as [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11]] which a a 2D array of dimension ('C' ordered) [4, 3]
     * @param {Array} arr - the potentially multidimensional nested array
     * @returns {Array|null} Return a dimension array where the first element is the size of the slowest varying dimension
     * and the last element is the fastest varying dimension. Returns null if the array is not valid
     */
    static getNestedArrayShape(arr) {
      const shape = [];

      if (!Array.isArray(arr)) {
        throw new Error('The value provided is not an Array')
      }

      let arrDigger = arr;

      while (Array.isArray(arrDigger)) {
        const len = arrDigger.length;
        if (len === 0) {
          throw new Error('An empty array cannot be used as data.')
        }
        shape.push(len);
        arrDigger = arrDigger[0];
      }

      return shape
    }


    /**
     * @static
     * Flattens a nested Array and get the shape
     * @param {Array} arr - a potentially nested Array
     * @returns {Object} like {array: Array, shape: Array}
     */
    static flattenNestedArray(arr) {
      const shape = NdRaster.getNestedArrayShape(arr);
      const array = arr.flat(shape.length);
      const expectedLength = shape.reduce((a, b) => a * b);

      // this ensures that all the element in a given dimension have the same size
      if (expectedLength !== array.length) {
        throw new Error('The provided nested Array has size inconsistencies.')
      }

      return {
        array,
        shape,
      }
    }

    static copyDataAsType(arr, targetDtype) {
      if (!(targetDtype in DTYPE_TO_TYPEDARRAY_CONSTRUCTOR)) {
        throw new Error('The target dtype is not valid.')
      }

      const guessedDtype = NdRaster.guessDtype(arr);

      if (guessedDtype === targetDtype) {
        return arr.slice()
      }

      const bounds = DTYPE_TO_BOUND[targetDtype];
      const arrCopy = new DTYPE_TO_TYPEDARRAY_CONSTRUCTOR[targetDtype](arr.length);
      const length = arr.length;

      for (let i = 0; i < length; i += 1) {
        let boundedValue = arr[i];
        if (boundedValue < bounds.min) {
          boundedValue = bounds.min;
        } else if (boundedValue > bounds.max) {
          boundedValue = bounds.max;
        }
        arrCopy[i] = boundedValue;
      }
      return arrCopy
    }
  }


    // TODO:
    // copy/clone/astype
    // stat (min max)
    // get multiple values at once (all dim) --> slice
    // forEach
    // simple operator + - / * (with scalar and other NdRasters) --> create a new one
    // Constructor: data should be optional but at least one of data and shape must be provided

  var index = ({
    NdRaster,
  });

  return index;

})));
//# sourceMappingURL=ndraster.umd.js.map
