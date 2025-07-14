// Added line at the top to test diff functionality
function calculateTotal(items) {
	return items.reduce((sum, item) => {
		const price = parseFloat(item.price) || 0;
		const quantity = parseInt(item.quantity) || 0;
		return sum + price * quantity;
	}, 0);
}

function formatCurrency(amount) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount);
}

function validateEmail(email) {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

class ShoppingCart {
	constructor() {
		this.items = [];
	}

	addItem(product, quantity = 1) {
		const existingItem = this.items.find((item) => item.id === product.id);

		if (existingItem) {
			existingItem.quantity += quantity;
		} else {
			this.items.push({
				id: product.id,
				name: product.name,
				price: product.price,
				quantity: quantity,
			});
		}
	}

	removeItem(productId) {
		this.items = this.items.filter((item) => item.id !== productId);
	}

	getTotal() {
		return calculateTotal(this.items);
	}

	clear() {
		this.items = [];
	}
}

export { ShoppingCart, calculateTotal, formatCurrency, validateEmail };
