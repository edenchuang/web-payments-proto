import hyperHTML from "hyperhtml";
import PaymentCurrencyAmount from "./PaymentCurrencyAmount";
import PaymentShippingOption from "./PaymentShippingOption";
import PaymentItem from "./PaymentItem";
const privates = new WeakMap();

export default class OrderSummary {
  constructor(summaryElem, sections = [], defaultCurrency = "USD") {
    const priv = privates.set(this, new Map()).get(this);
    priv.set("sections", sections);
    priv.set("renderer", hyperHTML.bind(summaryElem));
    priv.set("defaultCurrency", defaultCurrency);
    sections.forEach(section =>
      section.addEventListener("change", this.render.bind(this)));
    this.render();
  }

  sumTotal() {
    const sections = privates.get(this).get("sections");
    const sum = Array.from(sections)
      .map(section => section.displayItems)
      .reduce((accumulator, item) => accumulator.concat(item), [])
      .map(({ amount: { value } }) => parseInt(value, 10))
      .reduce((accumulator, value) => accumulator + value, 0);
    const defaultCurrency = privates.get(this).get("defaultCurrency");
    const totalAmount = new PaymentCurrencyAmount(defaultCurrency, sum);
    const displayItem = new PaymentItem("Total", totalAmount);
    return displayItem;
  }

  render() {
    const priv = privates.get(this);
    const renderer = priv.get("renderer");
    const sections = priv.get("sections");
    const clickHandler = doPaymentRequest.bind(this);
    const { amount: { value, currency } } = this.sumTotal();
    const formatter = new Intl.NumberFormat("en-us", {
      style: "currency",
      currency,
      currencyDisplay: "symbol",
    });
    return renderer`
      <h3>Order summary</h3>
      <section>${sections.map(section => section.containerElem)}</section>
      <section>
        <dl class="order-summary-total">
          <dt>Total</dt>
          <dd>${formatter.format(value)}</dd>
        </dl>
      </section>
      <div id="button-container">
        <button id="checkout-button" onclick="${clickHandler}">Checkout</button>
      </div>
    `;
  }
}

function makeSplitter(condition) {
  return (accumulator = { left: [], right: [] }, item) => {
    const { left, right } = accumulator;
    const bucket = condition(item) ? left : right;
    bucket.push(item);
    return accumulator;
  };
}

async function doPaymentRequest() {
  const sections = privates.get(this).get("sections");
  const typeSplitter = makeSplitter(
    item => item instanceof PaymentShippingOption
  );
  const { left: shippingOptions, right: displayItems } = Array.from(sections)
    .map(section => section.displayItems)
    .reduce((accumulator, items) => accumulator.concat(items), [])
    .reduce(typeSplitter, undefined);
  const total = this.sumTotal();
  const methodData = [
    {
      supportedMethods: ["basic-card"],
    },
  ];
  const id = `super-store-order-${String(Math.random()).substr(2)}`;
  const details = {
    id,
    displayItems: displayItems.map(item => item.toObject()),
    total: total.toObject(),
    shippingOptions: shippingOptions.map(item => item.toObject()),
  };
  const options = {
    requestShipping: true,
    requestPayerName: true,
    requestPayerPhone: true,
  };
  const request = new PaymentRequest(methodData, details, options);

  request.onshippingoptionchange = ev => {
    console.log("hmmm.... onshippingoptionchange", ev);
  };
  request.onshippingaddresschange = ev => {
    console.log("hmmm.... onshippingaddresschange", ev);
  };
  request.show().then(processResponse).catch(err => console.log(err));
  return false;
}

function processResponse(r) {
  setTimeout(
    async () => {
      await r.complete("success");
      document
        .querySelectorAll(".main-stuff")
        .forEach(elem => elem.setAttribute("hidden", true));
      document.querySelector("#payment-complete").removeAttribute("hidden");
    },
    2000
  );
}
