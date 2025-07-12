<script lang="ts">
  import { onMount } from 'svelte'
  import { SelectFile, CompareFiles, type DiffResult, type DiffLine } from '../wailsjs/go/main/App.js'

  let leftFilePath: string = ""
  let rightFilePath: string = ""
  let leftFileName: string = "Select left file..."
  let rightFileName: string = "Select right file..."
  let diffResult: DiffResult | null = null
  let isComparing: boolean = false
  let errorMessage: string = ""
  let leftPane: HTMLElement
  let rightPane: HTMLElement
  let isScrollSyncing: boolean = false
  let isDarkMode: boolean = true
  
  $: isSameFile = leftFilePath && rightFilePath && leftFilePath === rightFilePath
  $: areFilesIdentical = diffResult && diffResult.lines && diffResult.lines.length > 0 && 
      diffResult.lines.every(line => line.type === 'same') && 
      leftFilePath !== rightFilePath

  async function selectLeftFile(): Promise<void> {
    try {
      console.log("Selecting left file...")
      const path = await SelectFile()
      console.log("Left file selected:", path)
      if (path) {
        leftFilePath = path
        leftFileName = path.split('/').pop() || path
        errorMessage = `Left file selected: ${leftFileName}`
        diffResult = null // Clear previous results
      } else {
        errorMessage = "No left file selected"
      }
    } catch (error) {
      console.error("Error selecting left file:", error)
      errorMessage = `Error selecting left file: ${error}`
    }
  }

  async function selectRightFile(): Promise<void> {
    try {
      console.log("Selecting right file...")
      const path = await SelectFile()
      console.log("Right file selected:", path)
      if (path) {
        rightFilePath = path
        rightFileName = path.split('/').pop() || path
        errorMessage = `Right file selected: ${rightFileName}`
        diffResult = null // Clear previous results
      } else {
        errorMessage = "No right file selected"
      }
    } catch (error) {
      console.error("Error selecting right file:", error)
      errorMessage = `Error selecting right file: ${error}`
    }
  }

  async function compareBothFiles(): Promise<void> {
    if (!leftFilePath || !rightFilePath) {
      errorMessage = "Please select both files before comparing"
      return
    }
    
    try {
      isComparing = true
      errorMessage = ""
      console.log("Starting comparison of:", leftFilePath, "vs", rightFilePath)
      
      diffResult = await CompareFiles(leftFilePath, rightFilePath)
      console.log("Comparison result:", diffResult)
      if (diffResult && diffResult.lines && diffResult.lines.length > 0) {
        console.log("First line sample:", diffResult.lines[0])
      }
      
      if (!diffResult || !diffResult.lines) {
        errorMessage = "No comparison result received"
        diffResult = null
      } else if (diffResult.lines.length === 0) {
        errorMessage = "Files are identical"
      }
    } catch (error) {
      console.error("Comparison error:", error)
      errorMessage = `Error comparing files: ${error}`
      diffResult = null
    } finally {
      isComparing = false
    }
  }

  function getLineClass(type: string): string {
    switch (type) {
      case 'added': return 'line-added'
      case 'removed': return 'line-removed'
      case 'modified': return 'line-modified'
      default: return 'line-same'
    }
  }


  function syncLeftScroll() {
    if (isScrollSyncing || !leftPane || !rightPane) return
    isScrollSyncing = true
    // Sync both vertical and horizontal scrolling from left to right pane
    rightPane.scrollTop = leftPane.scrollTop
    rightPane.scrollLeft = leftPane.scrollLeft
    setTimeout(() => isScrollSyncing = false, 10)
  }

  function syncRightScroll() {
    if (isScrollSyncing || !leftPane || !rightPane) return
    isScrollSyncing = true
    // Sync both vertical and horizontal scrolling from right to left pane
    leftPane.scrollTop = rightPane.scrollTop
    leftPane.scrollLeft = rightPane.scrollLeft
    setTimeout(() => isScrollSyncing = false, 10)
  }

  function expandTildePath(path: string): string {
    if (path.startsWith('~/')) {
      const home = process.env.HOME || process.env.USERPROFILE || ''
      return path.replace('~', home)
    }
    return path
  }

  function getDisplayPath(leftPath: string, rightPath: string, isLeft: boolean): string {
    const targetPath = isLeft ? leftPath : rightPath
    const otherPath = isLeft ? rightPath : leftPath
    
    if (!targetPath || !otherPath) return targetPath || ''
    
    const targetSegments = targetPath.split('/').filter(s => s !== '')
    const otherSegments = otherPath.split('/').filter(s => s !== '')
    
    if (targetSegments.length === 0) return targetPath
    
    // Always show exactly 4 segments (3 directories + filename) when possible
    const totalSegmentsToShow = 4
    
    // If we have 4 or fewer segments, show them all
    if (targetSegments.length <= totalSegmentsToShow) {
      return targetSegments.join('/')
    }
    
    // Show the last 4 segments (3 directories + filename)
    const segments = targetSegments.slice(-totalSegmentsToShow)
    return '.../' + segments.join('/')
  }

  async function initializeDefaultFiles(): Promise<void> {
    try {
      const leftPath = '/Users/54695/Development/lookout-software/weld/tests/sample-files/js-sample-1.js'
      const rightPath = '/Users/54695/Development/lookout-software/weld/tests/sample-files/js-sample-2.js'
      
      leftFilePath = leftPath
      leftFileName = leftPath.split('/').pop() || leftPath
      
      rightFilePath = rightPath
      rightFileName = rightPath.split('/').pop() || rightPath
      
      errorMessage = `Default files loaded: ${leftFileName} and ${rightFileName}`
    } catch (error) {
      console.error('Error initializing default files:', error)
      errorMessage = `Error loading default files: ${error}`
    }
  }

  function toggleDarkMode(): void {
    isDarkMode = !isDarkMode
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
  }

  onMount(() => {
    initializeDefaultFiles()
    document.documentElement.setAttribute('data-theme', 'dark')
  })
</script>

<main>
  <div class="header">
    <button class="theme-toggle" on:click={toggleDarkMode} title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}>
      {#if isDarkMode}
        ☀️
      {:else}
        🌙
      {/if}
    </button>
    <div class="file-selectors">
      <button class="file-btn" on:click={selectLeftFile}>
        📂 {leftFileName}
      </button>
      <button class="file-btn" on:click={selectRightFile}>
        📂 {rightFileName}
      </button>
      {#if leftFilePath && rightFilePath}
        <button class="compare-btn" on:click={compareBothFiles} disabled={isComparing}>
          {#if isComparing}
            Comparing files...
          {:else}
            Compare
          {/if}
        </button>
      {/if}
    </div>
    
    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}
  </div>

  <div class="diff-container">
    {#if diffResult}
      <div class="file-header">
        <div class="file-info left">{getDisplayPath(leftFilePath, rightFilePath, true)}</div>
        <div class="file-info right">{getDisplayPath(leftFilePath, rightFilePath, false)}</div>
      </div>
      
      {#if isSameFile}
        <div class="same-file-banner">
          <div class="warning-icon">⚠️</div>
          <div class="warning-text">
            File <strong>{getDisplayPath(leftFilePath, rightFilePath, true)}</strong> is being compared to itself
          </div>
        </div>
      {:else if areFilesIdentical}
        <div class="identical-files-banner">
          <div class="info-icon">💡</div>
          <div class="info-text">
            Files are identical
          </div>
        </div>
      {/if}
      
      <div class="diff-content">
        <div class="left-pane" bind:this={leftPane} on:scroll={syncLeftScroll}>
          <div class="pane-content">
            {#each diffResult.lines as line}
              <div class="line {getLineClass(line.type)}">
                <span class="line-number">{line.leftNumber || ''}</span>
                <span class="line-text">{line.leftLine || ' '}</span>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="right-pane" bind:this={rightPane} on:scroll={syncRightScroll}>
          <div class="pane-content">
            {#each diffResult.lines as line}
              <div class="line {getLineClass(line.type)}">
                <span class="line-number">{line.rightNumber || ''}</span>
                <span class="line-text">{line.rightLine || ' '}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else if leftFilePath && rightFilePath}
      <div class="empty-state">
        Files selected. Click "Compare Files" button above to see differences.
      </div>
    {:else}
      <div class="empty-state">
        Select two files to compare their differences
      </div>
    {/if}
  </div>
</main>

<style>
  :global(html) {
    transition: background-color 0.3s ease, color 0.3s ease;
  }

  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: all 0.3s ease;
    background: #eff1f5;
    color: #4c4f69;
  }

  /* Catppuccin Macchiato (Dark Mode) */
  :global([data-theme="dark"]) main {
    background: #24273a;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .header {
    background: #1e2030;
    border-bottom-color: #363a4f;
  }

  :global([data-theme="dark"]) .theme-toggle {
    color: #a5adcb;
    border-color: rgba(165, 173, 203, 0.3);
  }

  :global([data-theme="dark"]) .theme-toggle:hover {
    background: rgba(202, 211, 245, 0.1);
    border-color: rgba(202, 211, 245, 0.5);
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .file-btn {
    background: #363a4f;
    border-color: #5b6078;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .file-btn:hover {
    background: #414559;
  }

  :global([data-theme="dark"]) .compare-btn {
    background: #8aadf4;
    border-color: #8aadf4;
    color: #24273a;
  }

  :global([data-theme="dark"]) .compare-btn:hover:not(:disabled) {
    background: #7dc4e4;
  }

  :global([data-theme="dark"]) .file-header {
    background: #1e2030;
    border-bottom-color: #363a4f;
  }

  :global([data-theme="dark"]) .file-info {
    border-right-color: #363a4f;
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .left-pane,
  :global([data-theme="dark"]) .right-pane {
    background: #24273a;
    border-right-color: #363a4f;
  }

  :global([data-theme="dark"]) .line-number {
    background: #1e2030;
    border-right-color: #363a4f;
    color: #8087a2;
  }

  :global([data-theme="dark"]) .pane-content::after {
    background: #1e2030;
    border-right-color: #363a4f;
  }

  :global([data-theme="dark"]) .line-text {
    color: #cad3f5 !important;
  }

  :global([data-theme="dark"]) .error {
    background: #ed8796;
    color: #24273a;
  }

  :global([data-theme="dark"]) .empty-state {
    color: #a5adcb;
  }

  .header {
    padding: 1rem;
    border-bottom: 1px solid #dce0e8;
    background: #e6e9ef;
    position: relative;
  }

  .theme-toggle {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: 1px solid rgba(108, 111, 133, 0.3);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    color: #6c6f85;
    transition: all 0.2s ease;
  }

  .theme-toggle:hover {
    background: rgba(76, 79, 105, 0.1);
    border-color: rgba(76, 79, 105, 0.5);
    color: #4c4f69;
  }

  /* Make moon emoji darker in light mode for better contrast */
  .theme-toggle {
    filter: grayscale(0.3) brightness(0.7);
  }

  :global([data-theme="dark"]) .theme-toggle {
    filter: none;
  }

  /* Custom scrollbar styling for light mode (Catppuccin Latte) */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  ::-webkit-scrollbar-track {
    background: #dce0e8;
  }

  ::-webkit-scrollbar-thumb {
    background: #acb0be;
    border-radius: 6px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #9ca0b0;
  }

  ::-webkit-scrollbar-corner {
    background: #dce0e8;
  }

  /* Custom scrollbar styling for dark mode (Catppuccin Macchiato) */
  :global([data-theme="dark"]) ::-webkit-scrollbar-track {
    background: #363a4f;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-thumb {
    background: #5b6078;
    border-radius: 6px;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-thumb:hover {
    background: #6e738d;
  }

  :global([data-theme="dark"]) ::-webkit-scrollbar-corner {
    background: #363a4f;
  }

  h1 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: #333;
  }

  .file-selectors {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .file-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #acb0be;
    border-radius: 4px;
    background: #dce0e8;
    cursor: pointer;
    font-size: 0.9rem;
    min-width: 200px;
    text-align: left;
    color: #4c4f69;
  }

  .file-btn:hover {
    background: #ccd0da;
  }

  .compare-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #1e66f5;
    border-radius: 4px;
    background: #1e66f5;
    color: #eff1f5;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    min-width: 150px;
    height: auto;
  }

  .compare-btn:hover:not(:disabled) {
    background: #04a5e5;
  }

  .compare-btn:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }


  .error {
    color: #d20f39;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: #eff1f5;
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  .loading {
    color: #0366d6;
    font-size: 0.9rem;
    padding: 0.5rem;
  }

  .diff-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .file-header {
    display: flex;
    border-bottom: 1px solid #dce0e8;
    background: #e6e9ef;
  }

  .file-info {
    flex: 1;
    padding: 0.5rem 0.5rem 0.5rem calc(50px + 1rem + 1px);
    font-weight: 400;
    color: #4c4f69;
    text-align: left;
    border-right: 1px solid #dce0e8;
  }

  .file-info.right {
    border-right: none;
  }

  .diff-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .left-pane, .right-pane {
    flex: 1;
    min-width: 0;
    width: 50%;
    border-right: 1px solid #dce0e8;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
    font-size: 0.9rem;
    line-height: 1.4;
    overflow: auto;
    background: #eff1f5;
    position: relative;
  }

  .right-pane {
    border-right: none;
  }

  .pane-content {
    display: inline-block;
    min-width: 100%;
    width: fit-content;
    position: relative;
  }

  .pane-content::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: calc(50px + 1rem + 1px);
    height: 100%;
    background: #e6e9ef;
    border-right: 1px solid #dce0e8;
    z-index: 0;
    pointer-events: none;
  }

  .line {
    display: flex;
    min-height: 1.4em;
    white-space: pre;
    align-items: flex-start;
    width: 100%;
  }

  .line-number {
    width: 50px;
    padding: 0 0.5rem;
    text-align: right;
    color: #6c6f85;
    background: #e6e9ef;
    border-right: 1px solid #dce0e8;
    user-select: none;
    flex-shrink: 0;
    position: sticky;
    left: 0;
    z-index: 1;
  }

  .line-text {
    padding: 0 0.5rem;
    color: #4c4f69 !important;
    white-space: pre;
    text-align: left;
    font-family: inherit;
    tab-size: 4;
    background: inherit;
    min-width: max-content;
    position: relative;
  }


  .line-same {
    background: #eff1f5;
  }

  .line-same .line-text {
    color: #4c4f69 !important;
  }

  .line-added {
    background: #dcfce7;
    border-left: 3px solid #22c55e;
  }

  .line-added .line-number {
    background: #bbf7d0;
    color: #166534;
  }

  .line-added .line-text {
    color: #166534 !important;
  }

  .line-removed {
    background: #fef2f2;
    border-left: 3px solid #ef4444;
  }

  .line-removed .line-number {
    background: #fecaca;
    color: #991b1b;
  }

  .line-removed .line-text {
    color: #991b1b !important;
  }

  .line-modified {
    background: #fef3c7;
    border-left: 3px solid #f59e0b;
  }

  .line-modified .line-number {
    background: #fde68a;
    color: #92400e;
  }

  .line-modified .line-text {
    color: #92400e !important;
  }

  /* Dark mode line overrides */
  :global([data-theme="dark"]) .line-same {
    background: #24273a;
  }

  :global([data-theme="dark"]) .line-same .line-text {
    color: #cad3f5 !important;
  }

  :global([data-theme="dark"]) .line-added {
    background: #1e3a2e;
    border-left-color: #a6da95;
  }

  :global([data-theme="dark"]) .line-added .line-number {
    background: #2d5016;
    color: #a6da95;
  }

  :global([data-theme="dark"]) .line-added .line-text {
    color: #a6da95 !important;
  }

  :global([data-theme="dark"]) .line-removed {
    background: #3e2723;
    border-left-color: #ed8796;
  }

  :global([data-theme="dark"]) .line-removed .line-number {
    background: #5d1a1d;
    color: #ed8796;
  }

  :global([data-theme="dark"]) .line-removed .line-text {
    color: #ed8796 !important;
  }

  :global([data-theme="dark"]) .line-modified {
    background: #3e3424;
    border-left-color: #eed49f;
  }

  :global([data-theme="dark"]) .line-modified .line-number {
    background: #5d4e1a;
    color: #eed49f;
  }

  :global([data-theme="dark"]) .line-modified .line-text {
    color: #eed49f !important;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6c6f85;
    font-size: 1.1rem;
  }

  .same-file-banner {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #fdf6e3;
    color: #d20f39;
    border-top: 1px solid #df8e1d;
    border-left: 4px solid #df8e1d;
    border-right: 4px solid #df8e1d;
    border-bottom: 1px solid #df8e1d;
    font-size: 0.9rem;
    gap: 0.5rem;
  }

  .warning-icon {
    font-size: 1.1rem;
    color: #df8e1d;
  }

  .warning-text {
    flex: 1;
    color: #4c4f69;
  }

  .warning-text strong {
    font-weight: 600;
    color: #d20f39;
  }

  /* Dark mode banner styling */
  :global([data-theme="dark"]) .same-file-banner {
    background: #363a4f;
    color: #cad3f5;
    border-top-color: #f5a97f;
    border-left-color: #f5a97f;
    border-right-color: #f5a97f;
    border-bottom-color: #f5a97f;
  }

  :global([data-theme="dark"]) .warning-icon {
    color: #f5a97f;
  }

  :global([data-theme="dark"]) .warning-text {
    color: #cad3f5;
  }

  :global([data-theme="dark"]) .warning-text strong {
    color: #f5a97f;
  }

  .identical-files-banner {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f0f9ff;
    color: #0369a1;
    border-top: 1px solid #0ea5e9;
    border-left: 4px solid #0ea5e9;
    border-right: 4px solid #0ea5e9;
    border-bottom: 1px solid #0ea5e9;
    font-size: 0.9rem;
    gap: 0.5rem;
  }

  .info-icon {
    font-size: 1.1rem;
    color: #0ea5e9;
  }

  .info-text {
    flex: 1;
    color: #0369a1;
    font-weight: 500;
  }

  /* Dark mode identical files banner styling */
  :global([data-theme="dark"]) .identical-files-banner {
    background: #363a4f;
    color: #7dc4e4;
    border-top-color: #7dc4e4;
    border-left-color: #7dc4e4;
    border-right-color: #7dc4e4;
    border-bottom-color: #7dc4e4;
  }

  :global([data-theme="dark"]) .info-icon {
    color: #7dc4e4;
  }

  :global([data-theme="dark"]) .info-text {
    color: #7dc4e4;
  }
</style>
