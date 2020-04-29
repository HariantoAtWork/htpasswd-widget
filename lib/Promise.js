import { Promise } from 'bluebird'
Promise.config({
	// Enable cancellation
	cancellation: true
})

export default Promise
