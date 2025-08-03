<script lang="ts">
export let message: string;
</script>

{#if message}
  <div class="error">{message}</div>
{/if}

<style>
  .error {
    color: #d20f39;
    font-size: 0.9rem;
    padding: 0.5rem;
    background: #eff1f5;
    border-radius: 4px;
    margin-top: 0.5rem;
  }

  :global([data-theme="dark"]) .error {
    background: #ed8796;
    color: #24273a;
  }
</style>