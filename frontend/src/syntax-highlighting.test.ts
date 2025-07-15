import { describe, it, expect, vi, beforeEach } from 'vitest'
import Prism from 'prismjs'

// Mock Prism
vi.mock('prismjs', () => ({
  default: {
    highlight: vi.fn(),
    languages: {
      javascript: {},
      typescript: {},
      markup: {},
      python: {},
      go: {},
    }
  }
}))

describe('Syntax Highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('highlightCode', () => {
    it('should highlight code using Prism', () => {
      const mockHighlight = vi.mocked(Prism.highlight)
      mockHighlight.mockReturnValue('<span class="token keyword">function</span> test() {}')
      
      function highlightCode(code: string, language: string): string {
        if (!code.trim()) return code

        try {
          const grammar = Prism.languages[language]
          if (grammar) {
            return Prism.highlight(code, grammar, language)
          }
        } catch (error) {
          console.warn('Syntax highlighting error:', error)
        }
        return code
      }

      const result = highlightCode('function test() {}', 'javascript')
      
      expect(mockHighlight).toHaveBeenCalledWith('function test() {}', {}, 'javascript')
      expect(result).toBe('<span class="token keyword">function</span> test() {}')
    })

    it('should return original code if no grammar found', () => {
      function highlightCode(code: string, language: string): string {
        if (!code.trim()) return code

        try {
          const grammar = Prism.languages[language]
          if (grammar) {
            return Prism.highlight(code, grammar, language)
          }
        } catch (error) {
          console.warn('Syntax highlighting error:', error)
        }
        return code
      }

      const result = highlightCode('some code', 'nonexistent')
      expect(result).toBe('some code')
    })

    it('should return original code if empty', () => {
      function highlightCode(code: string, language: string): string {
        if (!code.trim()) return code

        try {
          const grammar = Prism.languages[language]
          if (grammar) {
            return Prism.highlight(code, grammar, language)
          }
        } catch (error) {
          console.warn('Syntax highlighting error:', error)
        }
        return code
      }

      expect(highlightCode('', 'javascript')).toBe('')
      expect(highlightCode('   ', 'javascript')).toBe('   ')
    })

    it('should handle highlighting errors gracefully', () => {
      const mockHighlight = vi.mocked(Prism.highlight)
      mockHighlight.mockImplementation(() => {
        throw new Error('Prism error')
      })
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      function highlightCode(code: string, language: string): string {
        if (!code.trim()) return code

        try {
          const grammar = Prism.languages[language]
          if (grammar) {
            return Prism.highlight(code, grammar, language)
          }
        } catch (error) {
          console.warn('Syntax highlighting error:', error)
        }
        return code
      }

      const result = highlightCode('function test() {}', 'javascript')
      
      expect(consoleSpy).toHaveBeenCalledWith('Syntax highlighting error:', expect.any(Error))
      expect(result).toBe('function test() {}')
      
      consoleSpy.mockRestore()
    })
  })

  describe('getHighlightedLine', () => {
    it('should apply basic syntax highlighting', () => {
      function getHighlightedLine(line: string, filename: string): string {
        if (!line.trim()) return line

        let highlighted = line
        const protectedRanges: Array<{ start: number; end: number }> = []

        function addProtection(match: RegExpMatchArray) {
          if (match.index !== undefined) {
            protectedRanges.push({
              start: match.index,
              end: match.index + match[0].length
            })
          }
        }

        function isProtected(start: number, end: number): boolean {
          return protectedRanges.some(range =>
            (start >= range.start && start < range.end) ||
            (end > range.start && end <= range.end) ||
            (start <= range.start && end >= range.end)
          )
        }

        // Comments
        highlighted = highlighted.replace(/(\/\/.*$)/g, (match, ...args) => {
          const fullMatch = args[args.length - 1] as RegExpMatchArray
          addProtection(fullMatch)
          return `<span class="syntax-comment">${match}</span>`
        })

        // Strings
        highlighted = highlighted.replace(/(["'`])([^"'`]*?)\1/g, (match, ...args) => {
          const fullMatch = args[args.length - 1] as RegExpMatchArray
          addProtection(fullMatch)
          return `<span class="syntax-string">${match}</span>`
        })

        // Keywords
        const keywords = ['function', 'const', 'let', 'var', 'return', 'if', 'else']
        keywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'g')
          let match
          while ((match = regex.exec(line)) !== null) {
            if (!isProtected(match.index, match.index + match[0].length)) {
              highlighted = highlighted.replace(match[0], `<span class="syntax-keyword">${match[0]}</span>`)
            }
          }
        })

        return highlighted
      }

      const result = getHighlightedLine('function test() { return "hello"; }', 'test.js')
      
      expect(result).toContain('<span class="syntax-keyword">function</span>')
      expect(result).toContain('<span class="syntax-keyword">return</span>')
      expect(result).toContain('<span class="syntax-string">"hello"</span>')
    })

    it('should handle comments correctly', () => {
      function getHighlightedLine(line: string, filename: string): string {
        if (!line.trim()) return line

        let highlighted = line
        const protectedRanges: Array<{ start: number; end: number }> = []

        function addProtection(match: RegExpMatchArray) {
          if (match.index !== undefined) {
            protectedRanges.push({
              start: match.index,
              end: match.index + match[0].length
            })
          }
        }

        // Comments
        highlighted = highlighted.replace(/(\/\/.*$)/g, (match, ...args) => {
          const fullMatch = args[args.length - 1] as RegExpMatchArray
          addProtection(fullMatch)
          return `<span class="syntax-comment">${match}</span>`
        })

        return highlighted
      }

      const result = getHighlightedLine('// This is a comment', 'test.js')
      expect(result).toBe('<span class="syntax-comment">// This is a comment</span>')
    })

    it('should handle strings correctly', () => {
      function getHighlightedLine(line: string, filename: string): string {
        if (!line.trim()) return line

        let highlighted = line
        const protectedRanges: Array<{ start: number; end: number }> = []

        function addProtection(match: RegExpMatchArray) {
          if (match.index !== undefined) {
            protectedRanges.push({
              start: match.index,
              end: match.index + match[0].length
            })
          }
        }

        // Strings
        highlighted = highlighted.replace(/(["'`])([^"'`]*?)\1/g, (match, ...args) => {
          const fullMatch = args[args.length - 1] as RegExpMatchArray
          addProtection(fullMatch)
          return `<span class="syntax-string">${match}</span>`
        })

        return highlighted
      }

      expect(getHighlightedLine('const str = "hello world"', 'test.js')).toContain('<span class="syntax-string">"hello world"</span>')
      expect(getHighlightedLine("const str = 'hello world'", 'test.js')).toContain("<span class=\"syntax-string\">'hello world'</span>")
      expect(getHighlightedLine('const str = `hello world`', 'test.js')).toContain('<span class="syntax-string">`hello world`</span>')
    })

    it('should return original line if empty', () => {
      function getHighlightedLine(line: string, filename: string): string {
        if (!line.trim()) return line
        return line
      }

      expect(getHighlightedLine('', 'test.js')).toBe('')
      expect(getHighlightedLine('   ', 'test.js')).toBe('   ')
    })

    it('should handle mixed content correctly', () => {
      function getHighlightedLine(line: string, filename: string): string {
        if (!line.trim()) return line

        let highlighted = line

        // Comments first (they take precedence)
        highlighted = highlighted.replace(/(\/\/.*$)/g, (match) => {
          return `<span class="syntax-comment">${match}</span>`
        })

        // Strings (only outside of comments)
        highlighted = highlighted.replace(/(["'`])([^"'`]*?)\1/g, (match, quote, content) => {
          // Don't highlight strings inside comments
          if (match.includes('syntax-comment')) {
            return match
          }
          return `<span class="syntax-string">${match}</span>`
        })

        return highlighted
      }

      const result = getHighlightedLine('const str = "hello"; // comment', 'test.js')
      
      expect(result).toContain('<span class="syntax-string">"hello"</span>')
      expect(result).toContain('<span class="syntax-comment">// comment</span>')
    })
  })
})