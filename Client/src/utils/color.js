export default function getColor(data) {
	return data < 0
		? "text-red-700 dark:text-red-400"
		: "text-green-700 dark:text-green-400";
}
