/**
 * Common CTF Tools implementation
 */

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
      let result = '';
      for (let i = 0; i < input.length; i++) {
        result += input.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return result;
    },
    decode: (input: string) => {
      try {
        let hex = input.toString();
        let str = '';
        for (let n = 0; n < hex.length; n += 2) {
          str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        }
        return str;
      } catch (e) {
        return "错误：无效的 Hex 字符串";
      }
    }
  },
  rot13: (input: string) => {
    return input.replace(/[a-zA-Z]/g, (char) => {
      const base = char <= 'Z' ? 65 : 97;
      return String.fromCharCode(
        ((char.charCodeAt(0) - base + 13) % 26) + base
      );
    });
  },
  url: {
    encode: (input: string) => encodeURIComponent(input),
    decode: (input: string) => decodeURIComponent(input)
  }
};
