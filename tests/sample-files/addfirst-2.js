// Added line at the top to test diff functionality
/**
 * Calculates the total cost of all items in a shopping cart
 * @param {Array} items - Array of item objects with price and quantity
 * @returns {number} The total cost as a decimal number
 */
function calculateTotal(items) {
	return items.reduce((sum, item) => {
		const price = parseFloat(item.price) || 0;
		const quantity = parseInt(item.quantity) || 0;
		return sum + price * quantity;
	}, 0);
}

/*
 * Formats a numeric amount as USD currency
 * Uses the built-in Intl.NumberFormat for proper localization
 */
function formatCurrency(amount) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount);
}

/**
 * Validates an email address using a regular expression
 * @param {string} email - The email address to validate
 * @returns {boolean} True if email format is valid, false otherwise
 */
function validateEmail(email) {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

/*
 * ShoppingCart class for managing e-commerce cart operations
 * Supports adding, removing, and calculating totals for items
 * Maintains an internal array of cart items with quantities
 */
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
