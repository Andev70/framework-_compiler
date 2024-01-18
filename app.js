
    export default function() {
      let button_1;
let txt_2;
let div_3;
let txt_4;
let button_5;
let txt_6;
let button_7;
let txt_8;
let p_9;
let txt_10;
      let counter = 0;
let differ = 'ok';
const increment = () => (counter++, lifecycle.update(['counter']));
const decrement = () => (counter--, lifecycle.update(['counter']));
const changeDiff = () =>
    ({
        differ = 'hhdhfhh';
    }, (lifecycle.update(['differ'])));
      const lifecycle = {
        create(target) {
          button_1 = document.createElement('button');
button_1.addEventListener('click', decrement);
txt_2 = document.createTextNode('Decrement')
button_1.appendChild(txt_2)
target.appendChild(button_1)
div_3 = document.createElement('div');
txt_4 = document.createTextNode(counter)
div_3.appendChild(txt_4);
target.appendChild(div_3)
button_5 = document.createElement('button');
button_5.addEventListener('click', increment);
txt_6 = document.createTextNode('Increment')
button_5.appendChild(txt_6)
target.appendChild(button_5)
button_7 = document.createElement('button');
button_7.addEventListener('click', changeDiff);
txt_8 = document.createTextNode('change')
button_7.appendChild(txt_8)
target.appendChild(button_7)
p_9 = document.createElement('p');
txt_10 = document.createTextNode(differ)
p_9.appendChild(txt_10);
target.appendChild(p_9)
        },
        update(changed) {
          if (changed.includes('counter')) {
            txt_4.data = counter;
          }
if (changed.includes('differ')) {
            txt_10.data = differ;
          }
        },
        destroy() {
          button_1.removeEventListener('click', decrement);
target.removeChild(button_1)
target.removeChild(div_3)
button_5.removeEventListener('click', increment);
target.removeChild(button_5)
button_7.removeEventListener('click', changeDiff);
target.removeChild(button_7)
target.removeChild(p_9)
        },
      };
      return lifecycle;
    }
  