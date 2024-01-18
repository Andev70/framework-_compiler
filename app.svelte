
<script>
  let counter = 0;
let differ="ok"
  const increment = () => counter++;
  const decrement = () => counter--;
  const changeDiff = ()=>{
    differ="hhdhfhh"
  }
</script>

<style>  
button {
  background-color: orange;
  color: white;
  width: max-content;
  height: max-content;
  padding: 8px 12px;
  border-radius: 6.4px;
  border:none;
  
}
</style>
<button on:click={decrement}>Decrement</button>
<div>{counter}</div>
<button on:click={increment}>Increment</button>

<button on:click={changeDiff}>change</button>
<p>{differ}</p>
