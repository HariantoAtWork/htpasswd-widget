import bcrypt from 'bcryptjs'
import Promise from './lib/Promise'
import { saveAs } from 'file-saver/src/FileSaver'
// console.log({ bcrypt, Promise, saveAs })
;(() => {
	const loadTemplate = url =>
			fetch(url)
				.then(response => response.text())
				.catch(console.error.bind(console, 'FAIL: loadTemplate')),
		loadTemplates = templates => {
			const promises = templates => {
				const list = []
				templates.forEach(i => list.push(loadTemplate(i)))
				return list
			}

			return Promise.all(promises(templates)).catch(
				console.error.bind(console, 'FAIL: Promise.all')
			)
		},
		projectPath = '/content/images/files/js/htpasswd/',
		templates = [
			`${projectPath}htpasswd.less`,
			`${projectPath}htpasswd--app-tpl.html`,
			`${projectPath}htpasswd--panel-tpl.html`
		],
		d = document,
		prependStyle = (el, css) => {
			const style = d.createElement('style')
			style.innerHTML = css
			el.prepend(style)
		},
		hash = (text, options) =>
			new Promise((resolve, reject, onCancel) => {
				let cancelled = false

				onCancel(() => {
					cancelled = true
					reject({ reason: 'cancelled' })
				})

				const config = {
					saltLength: 10,
					...options
				}
				const wrapWithCancel = fn => data => {
					if (!cancelled) return fn(data)
				}

				Promise.resolve()
					.then(wrapWithCancel(bcrypt.genSalt.bind(bcrypt, config.saltLength)))
					.then(wrapWithCancel(bcrypt.hash.bind(bcrypt, text)))
					.then(resolve, reject)
			}),
		setLocalstorage = (prop, defaultValue) => {
			prop = prop.replace(/[\/!@#$%^&*]/g, '')
			return {
				get [prop]() {
					return JSON.parse(localStorage.getItem(prop)) || defaultValue || ''
				},
				set [prop](value) {
					localStorage.setItem(prop, JSON.stringify(value))
				}
			}
		}

	const model = {
			User: {
				username: '',
				password: ''
			}
		},
		storage = setLocalstorage('formData', {
			users: [Object.create(model.User)],
			path: ''
		})

	loadTemplates(templates)
		.then(values => {
			const [appStyle, appTpl, panelTpl] = values
			return less.render(appStyle).then(({ css }) => [css, appTpl, panelTpl])
		})
		.then(values => {
			const [appStyle, appTpl, panelTpl] = values

			// Component: Panel
			const Panel = {
				template: panelTpl,
				props: {
					'title': {
						type: String,
						defaultValue: ''
					},
					'value': {
						type: String,
						defaultValue: ''
					},
					'download': {
						type: String,
						defaultValue: 'file.txt'
					}
				},
				data: () => ({
					blob: ''
				}),
				methods: {
					onExportFile() {
						const { value, download } = this
						const blob = new Blob([value], {
							type: 'text/plaincharset=utf-8'
						})
						saveAs(blob, download)
					}
				}
			}

			// Root Component: App
			const App = new Vue({
				name: 'Htpasswd',
				components: {
					HtpasswdPanel: Panel
				},
				template: appTpl,
				data: () => ({
					formData: {
						users: [],
						path: ''
					},
					htaccessResult: '',
					htpasswdResult: '',
					show: false
				}),
				computed: {
					htaccessResultComputed() {
						const { path } = this.formData
						return this.generateHtaccess(path)
					}
				},
				watch: {
					formData: {
						handler: 'saveToStorage',
						deep: true
					},
					'formData.users': {
						handler: function (users) {
							storage.formData = this.formData
						},
						deep: true
					}
				},
				methods: {
					addUser() {
						this.formData.users.push(Object.create(model.User))
					},
					removeItem(list, index) {
						return list.length > 1 && list.splice(index, 1)
					},
					saveToStorage() {
						storage.formData = this.formData
					},
					generateHtaccess(path) {
						path = path.charAt(0) !== '/' ? `/${path}` : path
						path = path.charAt(path.length - 1) !== '/' ? `${path}/` : path
						return `AuthUserFile ${path === '' ? '/' : path}.htpasswd
AuthGroupFile /dev/null
AuthName "Restricted Access"
AuthType Basic
<limit GET>
	require valid-user
</Limit>`
					},
					generateHtpasswd(users) {
						const promises = []
						users.forEach(({ username, password }) => {
							const passwordHashed =
								(typeof password === 'string' &&
									hash(password).then(hashed => `${username}:${hashed}`)) ||
								`${username}:${password}`
							promises.push(passwordHashed)
						})
						return Promise.all(promises).then(values => values.join('\n'))
					},
					onGenerate(event) {
						this.show = false
						const { path, users } = this.formData

						Promise.all([
							this.generateHtaccess(path),
							this.generateHtpasswd(users)
						]).then(values => {
							const [htaccessResult, htpasswdResult] = values
							this.htaccessResult = htaccessResult
							this.htpasswdResult = htpasswdResult
							this.show = true
						})
					}
				},
				// Life Cycle
				created() {
					const { formData } = storage
					this.formData = formData
				},
				mounted() {
					prependStyle(this.$el, appStyle)
				}
			})

			App.$mount('#htpasswd-app')
		})
})()
