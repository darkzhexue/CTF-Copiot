/**
 * Common CTF Tools implementation
 */

// Morse code lookup tables defined once at module level to avoid rebuilding on every call.
const MORSE_ENCODE_TABLE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....',
  '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};

const MORSE_DECODE_TABLE: Record<string, string> = {
  '.-': 'a', '-...': 'b', '-.-.': 'c', '-..': 'd', '.': 'e', '..-.': 'f', '--.': 'g', '....': 'h', '..': 'i', '.---': 'j',
  '-.-': 'k', '.-..': 'l', '--': 'm', '-.': 'n', '---': 'o', '.--.': 'p', '--.-': 'q', '.-.': 'r', '...': 's', '-': 't',
  '..-': 'u', '...-': 'v', '.--': 'w', '-..-': 'x', '-.--': 'y', '--..': 'z',
  '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
  '.-.-.-': '.', '--..--': ',', '..--..': '?', '-.-.--': '!', '-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&',
  '---...': ':', '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"', '...-..-': '$', '.--.-.': '@'
};

export const tools = {
  base64: {
    encode: (input: string) => {
      try {
        return btoa(input);
      } catch (e) {
        return "错误：Base64 编码输入无效";
      }
    },
    decode: (input: string) => {
      try {
        return atob(input);
      } catch (e) {
        return "错误：无效的 Base64 字符串";
      }
    }
  },
  hex: {
    encode: (input: string) => {
      const parts: string[] = new Array(input.length);
      for (let i = 0; i < input.length; i++) {
        parts[i] = input.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return parts.join('');
    },
    decode: (input: string) => {
      try {
        const hex = input.toString();
        const parts: string[] = new Array(hex.length / 2);
        for (let n = 0; n < hex.length; n += 2) {
          parts[n / 2] = String.fromCharCode(parseInt(hex.slice(n, n + 2), 16));
        }
        return parts.join('');
      } catch (e) {
        return "错误：无效的 Hex 字符串";
      }
    }
  },
  binary: {
    encode: (input: string) => {
      return input
        .split('')
        .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
        .join(' ');
    },
    decode: (input: string) => {
      try {
        const chunks = input.trim().split(/\s+/).filter(Boolean);
        if (!chunks.length) return '';
        if (!chunks.every((chunk) => /^[01]{1,8}$/.test(chunk))) {
          return '错误：无效的二进制字符串';
        }
        return chunks
          .map((chunk) => String.fromCharCode(parseInt(chunk, 2)))
          .join('');
      } catch {
        return '错误：无效的二进制字符串';
      }
    }
  },
  ascii: {
    encode: (input: string) => {
      return input
        .split('')
        .map((char) => String(char.charCodeAt(0)))
        .join(' ');
    },
    decode: (input: string) => {
      try {
        const nums = input.trim().split(/\s+/).filter(Boolean);
        if (!nums.length) return '';
        if (!nums.every((n) => /^\d{1,3}$/.test(n) && Number(n) >= 0 && Number(n) <= 255)) {
          return '错误：无效的 ASCII 数字序列';
        }
        return nums
          .map((n) => String.fromCharCode(Number(n)))
          .join('');
      } catch {
        return '错误：无效的 ASCII 数字序列';
      }
    }
  },
  morse: {
    encode: (input: string) => {
      return input
        .toLowerCase()
        .split('')
        .map((ch) => {
          if (ch === ' ') return '/';
          return MORSE_ENCODE_TABLE[ch] || '?';
        })
        .join(' ');
    },
    decode: (input: string) => {
      try {
        const symbols = input.trim().split(/\s+/).filter(Boolean);
        if (!symbols.length) return '';
        return symbols
          .map((sym) => {
            if (sym === '/') return ' ';
            return MORSE_DECODE_TABLE[sym] || '?';
          })
          .join('');
      } catch {
        return '错误：无效的摩斯码';
      }
    }
  },
  rot13: {
    encode: (input: string) => {
      return input.replace(/[a-zA-Z]/g, (char) => {
        const base = char <= 'Z' ? 65 : 97;
        return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
      });
    },
    decode: (input: string) => {
      return input.replace(/[a-zA-Z]/g, (char) => {
        const base = char <= 'Z' ? 65 : 97;
        return String.fromCharCode(((char.charCodeAt(0) - base + 13) % 26) + base);
      });
    }
  },
  rot47: {
    encode: (input: string) => {
      return input.replace(/[!-~]/g, (char) => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(33 + ((code - 33 + 47) % 94));
      });
    },
    decode: (input: string) => {
      return input.replace(/[!-~]/g, (char) => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(33 + ((code - 33 + 47) % 94));
      });
    }
  },
  url: {
    encode: (input: string) => encodeURIComponent(input),
    decode: (input: string) => {
      try {
        return decodeURIComponent(input);
      } catch {
        return '错误：无效的 URL 编码字符串';
      }
    }
  }
};
