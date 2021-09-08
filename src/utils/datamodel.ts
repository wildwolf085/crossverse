import JSBI from 'jsbi'
import sizeOf from 'image-size'
import sharp from 'sharp'
import { Storage } from '@google-cloud/storage'
import Model from './model'
import { call, hash, now, generateCode, fromEther, toEther } from './helper'
import { Html_Register } from './email-template'
import gmail from './gmail'
import fs from 'fs'
import path from 'path'
import getConfig from 'next/config'
import Web3 from 'web3'
import abiStorefront from '@/config/abi/storefront.json'
import abiWETH from '@/config/abi/weth.json'
import Config from '@/config/v1.json'

import fsExtra from 'fs-extra'
const e8 = JSBI.BigInt(1e8)

const { parseLog } = require('./ethereum-event-logs')

const conf = (Config as CONFIG)[Number(process.env.CHAINID || 1)]
const confirmations = conf.confirmations

const privkey = '0x987ce137a3ab6478779e63d8d7e424950470be3db196c0288d7b0bf5d7b38fc2'
const signer = '0xCcC2fcaeeA78A87e002ab8fEFfd23eedc19CDE07'

const web3 = new Web3(conf.rpc)

const Nfts = new Model('nfts')
const Arts = new Model('arts')
const Artviews = new Model('artviews')
const Artlikes = new Model('artlikes')
const Users = new Model('users')
const Wallets = new Model('wallets', 'key')
const Userlog = new Model('userlog')
const Authcodes = new Model('authcodes', 'email')
const Trades = new Model('trades')
const Offers = new Model('offers', 'txid')
const Txs = new Model('txs', 'txid')
const Campaigns = new Model('campaigns')

const { serverRuntimeConfig } = getConfig()

const keyFilename = path.join( serverRuntimeConfig.PROJECT_ROOT, './src/config/gcp.json' )
const storage = new Storage({ keyFilename })
const bucketName: string = process.env.GOOGLE_BUCKET || ''
const bucket = storage.bucket(bucketName)
const temp = serverRuntimeConfig.PROJECT_ROOT + '/tmp'
const logPath = serverRuntimeConfig.PROJECT_ROOT + '/logs'

export const NullAddress = '0x0000000000000000000000000000000000000000'

export const setlog = (msg: string | Error | null = null): void => {
	try {
		const date = new Date()
		const y: number = date.getUTCFullYear()
		const m: number = date.getUTCMonth() + 1
		const d: number = date.getUTCDate()
		const hh: number = date.getUTCHours()
		const mm: number = date.getUTCMinutes()
		const ss: number = date.getUTCSeconds()
		const datetext: string = [ y, ('0' + m).slice(-2), ('0' + d).slice(-2), ].join('-')
		const timetext: string = [ ('0' + hh).slice(-2), ('0' + mm).slice(-2), ('0' + ss).slice(-2), ].join(':')
		if (msg instanceof Error) msg = msg.stack || msg.message
		const bStart = 0
		if (msg) msg = msg.split(/\r\n|\r|\n/g).map((v) => '\t' + v).join('')
		const text = `[${timetext}] ${msg === null ? '' : msg + '\r\n'}`
		fs.appendFileSync(logPath + '/' + datetext + '.log', (bStart ? '\r\n\r\n\r\n' : '') + text)
		if (process.env.NODE_ENV !== 'production') console.log(text)
	} catch (err:any) {
		console.log(err)
	}
}

const initialize = async (): Promise<any> => {
	if (!Model.db) await Model.connect()
	if (!global.inited) {
		global.inited = true
		global.users = {}
		global.alias = {}
		global.wallets = {}
		global.arts = {}
		global.lastTokenId = 0
		global.lastCheckTime = 0
		let rows: any = await Users.find({ alias: { $ne: null } })
		if (rows) {
			for (const v of rows) {
				updateGlobalUser({ id: v.id, alias: v.alias || '', about: v.about || '', })
			}
		}

		rows = await Wallets.find({})
		if (rows) {
			for (const v of rows) {
				global.wallets[v.key] = v.uid
			}
		}

		rows = await Arts.find({})
		if (rows) {
			for (const v of rows) {
				global.arts[v.id] = artwork(v)
				if (global.lastTokenId < v.id) global.lastTokenId = v.id
			}
		}
	}
}

const getRefId = (id: number, uid: number): string => {
	return JSBI.add( JSBI.multiply(JSBI.BigInt(id), e8), JSBI.BigInt(uid) ).toString(10)
}

const artwork = (v: any): Artwork => {
	let isVideo = false, isMusic = false
	const ext = v.file.slice(v.file.lastIndexOf('.') + 1)
	if (ext === 'mp3') {
		isMusic = true
	} else if (ext === 'mp4') {
		isVideo = true
	}
	const url = 'https://storage.googleapis.com/crossverse'
	const user = global.users[v.uid]
	return {
		id: v.id,
		key: v.key,
		store: v.store,
		category: v.category,
		title: v.name,
		author: '@' + user.alias,
		aboutAuthor: user.about || '',
		description: v.description || '',
		worknumber: v.worknumber || 0,
		file: `${url}/${v.file}`,
		thumbnail: `${url}/${v.thumbnail}`,
		isVideo,
		isMusic,
		price: toEther(v.price),
		auction: v.auction === 1,
		auctiontime: v.auctiontime || 0,
		instock: v.instock || 0,
		totalsupply: v.totalsupply || 0,
		volume: (v.volume || 0) / 1e6,
		views: v.views || 0,
		likes: v.likes || 0,
		dislikes: v.dislikes || 0,
		drop: v.drop === 1,
		pinned: v.pinned === 1,
		created: v.created,
	}
}

const updateGlobalUser = (data: User): void => {
	const v: any = global.users[data.id]
	if (v && global.alias[v.alias] !== undefined) delete global.alias[v.alias]
	if (data.alias !== '') global.alias[data.alias] = data.id
	global.users[data.id] = data
}

const deleteFromGCP = async (files: Array<string>): Promise<void> => {
	try {
		for (const file of files) {
			await bucket.file(file).delete()
		}
	} catch (err:any) {
		setlog(err)
	}
}

const uploadToGCP = (filename: string, buffer: any) => {
	return new Promise((resolve) => {
		try {
			const blob = bucket.file(filename)
			const blobStream = blob.createWriteStream({ resumable: false })

			blobStream.on('error', (err) => {
				resolve({ err: err.message })
			})

			blobStream.on('finish', () => {
				resolve(
					`https://storage.googleapis.com/${bucket.name}/${blob.name}`
				)
			})
			blobStream.end(buffer)
		} catch (err:any) {
			resolve({ err: `Could not upload the file: ${filename}. ${err}` })
		}
	})
}

const getArts = (type: 'drop' | 'pinned' | 'all'): Array<Artwork> => {
	const arts: any = global.arts
	const result: Array<Artwork> = []
	for (const id in arts) {
		const v = <Artwork>arts[id]
		if (type === 'all' && !v.drop) {
			result.push(v)
		} else if (type === 'drop' && v.drop) {
			result.push(v)
		} else if (type === 'pinned' && v.pinned) {
			result.push(v)
		}
	}
	return result
}

export const validateAddress = (address: string) => web3.utils.isAddress(address)

export const getAvailableTokenId = (): number => {
	let tokenid = global.lastTokenId
	if (tokenid < 1e8) tokenid = 1e8
	tokenid += Math.round(Math.random() * 100)
	return tokenid + 1
}
export const getETHPrice = async (): Promise<number> => {
	try {
		const time = now()
		if (!global.eth) global.eth = { price: 0, updated: time }
		if (!global.eth.price || time - global.eth.updated > 60) {
			const result = await fetch( 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT' )
			const json = await result.json()
			global.eth.price = Number(json.price)
			global.eth.updated = time
		}
		return global.eth.price
	} catch (err:any) {
		setlog(err)
	}
	return 0
}

export const toHex = (val: number): string => web3.utils.toHex(Math.round(val))

export const sign = async ( buyer: string, seller: string, tokenid: number, price: string, quantity: string, amount: string, timestamp: number ): Promise<string | null> => {
	try {
		const contract = new web3.eth.Contract( <any>abiStorefront, conf.storefront )
		const hash = await contract.methods.getMessageHash( buyer, seller, tokenid, price, quantity, amount, timestamp ).call()
		const { signature } = await web3.eth.accounts.sign(hash, privkey)
		return signature
	} catch (err:any) {
		setlog(err)
	}
	return null
}

const callBySigner = async ( to: string, abi: any, method: string, ...args: any[] ): Promise<string | null> => {
	try {
		const account = web3.eth.accounts.privateKeyToAccount(privkey)
		const contract = new web3.eth.Contract(abi, to, { from: account.address, })
		const data = contract.methods[method](...args).encodeABI()
		const gasPrice = await web3.eth.getGasPrice()
		const gasLimit = await contract.methods[method](...args).estimateGas()
		const json = { gasPrice, gasLimit, to, value: 0x0, data }
		const signedTx: any = await web3.eth.accounts.signTransaction( json, privkey )
		const receipt = await web3.eth.sendSignedTransaction( signedTx.rawTransaction )
		if (receipt && receipt.transactionHash) return receipt.transactionHash
	} catch (err:any) {
		setlog(err)
	}
	return null
}

export const updateTx = async ( uid: number, tx: Transaction ): Promise<boolean> => {
	try {
		const result = await Txs.insertOrUpdate({ uid, ...tx })
		return result !== null
	} catch (err:any) {
		setlog(err)
	}
	return false
}
export const updateOffer = async ( uid: number, offer: Offer ): Promise<boolean> => {
	try {
		await Offers.delete({ uid, tokenid: offer.tokenid, status: { $ne: 100 } })
		const result = await Offers.insert({ ...offer, price: fromEther(offer.price), amount: fromEther(offer.amount), uid })
		return result !== null
	} catch (err:any) {
		setlog(err)
	}
	return false
}
export const deleteOffer = async ( uid: number, tokenid:number ): Promise<boolean> => {
	try {
		const result = await Offers.delete({ uid, tokenid })
		return result !== null
	} catch (err:any) {
		setlog(err)
	}
	return false
}

export const checktxs = async (): Promise<boolean> => {
	try {
		await initialize()
		const rows = await Txs.find({ status: 0 })
		if (rows && rows.length) {
			const txs: {
				[k: number]: {
					txid: string
					from: string
					uid: number
					to: string
					created: number
				}
			} = {}
			const json = []
			let k = 0
			for (const v of rows) {
				txs[k] = {
					txid: v.txid,
					from: v.from,
					uid: v.uid,
					to: v.to,
					created: v.created,
				}
				json.push({
					jsonrpc: '2.0',
					method: 'eth_getTransactionReceipt',
					params: [v.txid],
					id: k,
				})
				k++
			}
			const results = await call(conf.rpc, json)
			if (results && results.length) {
				const current = await web3.eth.getBlock('latest')
				const updates: Array<{ txid: string; status: number }> = []
				const created = Number(current.timestamp)
				for (const json of results) {
					const tx = txs[json.id]
					const receipt = json.result
					if (receipt && receipt.blockNumber) {
						if (receipt.status === '0x1') {
							if ( current.number - receipt.blockNumber + 1 >= confirmations ) {
								if (tx.to === conf.storefront) {
									const events = parseLog( receipt.logs, abiStorefront )
									if (events) {
										for (const v of events) {
											if ( v.name === 'Buy' || v.name === 'Sell' ) {
												const gold = JSBI.BigInt( v.args.gold )
												const tokenid = JSBI.toNumber( JSBI.divide(gold, e8) )
												const quantity = JSBI.toNumber( JSBI.remainder(gold, e8) )
												const price = Math.round( Number(v.args.price) / 1e12 )
												const buyer = v.args.buyer
												const seller = v.args.seller === NullAddress ? null : v.args.seller
												const pid = v.args.pid
												await buy( tx.uid, global.arts[tokenid], price, quantity, buyer, seller, pid, created )
											} else if ( v.name === 'TransferSingle' ) {
												const from = v.args.from
												const to = v.args.to
												const tokenid = v.args.id
												const quantity = Number( v.args.value )
												await transfer( from, to, tokenid, quantity, created )
											} else if ( v.name === 'ApprovalForAll' ) {
												const account = v.args.account
												const operator = v.args.operator
												const approved = v.args.approved
												if ( operator === conf.storefront ) {
													const row = await Nfts.findOne( { uid: tx.uid, buyer: account, status: 1 } )
													if (row) {
														await Nfts.update( row.id, { status: approved ? 100 : 0, listed: now() } )
													}
												}
											}
										}
									}
								} else if (tx.to === conf.weth.contract) {
									const events = parseLog( receipt.logs, abiWETH )
									if (events) {
										for (const v of events) {
											if (v.name === 'Approval') {
												await Offers.update(tx.txid, { status: 1 })
											}
										}
									}
								}
								updates.push({ txid: tx.txid, status: 100 })
							}
						} else {
							updates.push({ txid: tx.txid, status: 1 })
						}
					} else {
						if (created - tx.created > 86400) {
							updates.push({ txid: tx.txid, status: 1 })
						}
					}
				}
				if (updates.length) {
					await Txs.insertOrUpdate(updates)
				}
			}
		}
		return true
	} catch (err:any) {
		setlog(err)
	}
	return false
}

const buy = async ( uid: number, art: Artwork, price: number, quantity: number, buyer: string, seller: string, pid: string, created: number ): Promise<void> => {
	try {
		let sellerid = 0
		if (pid.length === 66) {
			const row = await Offers.findOne(pid)
			if (row.quantity > quantity) {
				await Offers.update(pid, { quantity: row.quantity - quantity, amount: (row.quantity - quantity) * row.price })
			} else {
				await Offers.update(pid, { quantity: 0, amount: 0, status: 100 })
			}
			sellerid = uid
			uid = row.uid
			pid = '0'
		}
		if (seller === null) {
			if (art.instock > quantity) {
				art.instock -= quantity
			} else {
				art.instock = 0
			}
			await Arts.update(art.id, { instock: art.instock })
		} else {
			const row = await Nfts.findOne( pid === '0' ? { tokenid: art.id, uid: sellerid, buyer: seller } : Number(pid) )
			if (row) {
				const data: any = { updated: created }
				data.balance = row.balance - quantity
				if (data.balance <= 0) {
					data.balance = 0
					data.status = 0
					data.listed = 0
				}

				if (row.sellbalance) {
					data.sellbalance = row.sellbalance - quantity
					if (data.sellbalance <= 0) {
						data.sellprice = 0
						data.sellbalance = 0
						data.status = 0
						data.listed = 0
					}
				}
				await Nfts.update(row.id, data)
			}
		}
		const cur = await Nfts.findOne({ uid, buyer, tokenid: art.id })
		if (cur) {
			await Nfts.update(cur.id, { balance: cur.balance + quantity, price, updated: created })
		} else {
			await Nfts.insert({ tokenid: art.id, uid, price, balance: quantity, buyer, seller, created })
		}
		await Trades.insert({ uid, tokenid: art.id, event: 1, price, quantity, from: sellerid, to: uid, created })
		art.volume += (price * quantity) / 1e6
		await Arts.update(art.id, { volume: { $ad: price * quantity } })
	} catch (err:any) {
		setlog(err)
	}
}

const transfer = async ( from: string, to: string, tokenid: number, quantity: number, created: number ): Promise<void> => {
	try {
		const { wallets } = global
		let senderid = 0, receiverid = 0, senderPrice = 0
		const sender = await Nfts.findOne({ tokenid, buyer: from })
		if (sender) {
			const data: any = { updated: created }
			const balance = sender.balance - quantity

			if (balance <= 0) {
				data.balance = 0
				data.status = 0
			} else {
				data.balance = balance
			}
			if (sender.sellbalance) {
				const sellbalance = sender.sellbalance - quantity
				if (sellbalance <= 0) {
					data.sellbalance = 0
					data.status = 0
				} else {
					data.sellbalance = sellbalance
				}
			}
			await Nfts.update(sender.id, data)
			senderid = sender.uid
			senderPrice = sender.price
		}
		const receiver = await Nfts.findOne({ tokenid, buyer: to })
		if (receiver) {
			await Nfts.update(receiver.id, { balance: receiver.balance + quantity, updated: created })
			receiverid = 0
		} else {
			receiverid = wallets[to] || wallets[to.toLowerCase()] || 0
			await Nfts.insert({ tokenid, uid: receiverid, price: senderPrice, balance: quantity, buyer: to, seller: from, created })
		}
		await Trades.insert({ uid: senderid, tokenid, event: 2, price: senderPrice, quantity, from: senderid, to: receiverid, created })
	} catch (err:any) {
		setlog(err)
	}
}

export const getAssets = async (uid: number): Promise<Array<Artwork>> => {
	const result: Array<Artwork> = []
	try {
		await initialize()
		// const { users } = global
		const address = '' // users[uid] && users[uid].address
		if (address) {
			const contract = new web3.eth.Contract(
				<any>abiStorefront,
				conf.storefront
			)
			const res = await contract.methods.assetsByAccount(address).call()
			if (res) {
				const count = Number(res)
				const ids = []
				const tokens: { [tokenid: number]: number } = {}
				let start = 0
				while (start < count) {
					let end = start + 1000
					if (end >= count) end = count
					const assets = await contract.methods
						.assetsByAccount(address, start, end - 1)
						.call()
					if (assets && Array.isArray(assets)) {
						for (const v of assets) {
							const tokenid = Number(v[0])
							const balance = Number(v[1])
							if (balance) {
								ids.push(tokenid)
								tokens[tokenid] = balance
							}
						}
					}
					start = end
				}
				if (ids.length) {
					let rows: any = await Nfts.find({ uid })
					const assets: {
						[id: number]: { id: number; balance: number }
					} = {}
					for (const v of rows) {
						assets[v.tokenid] = {
							id: v.id,
							balance: v.balance,
						}
					}
					rows = await Arts.find({ id: ids })
					if (rows) {
						const inserts = []
						const updates = []
						for (const v of rows) {
							const art = artwork(v)
							const balance = tokens[art.id]
							if (assets[v.id] !== undefined) {
								if (assets[v.id].balance !== balance) {
									updates.push({
										id: assets[v.id].id,
										balance,
									})
								}
							} else {
								inserts.push({
									uid,
									tokenid: art.id,
									seller: null,
									price: fromEther(art.price),
									balance,
									status: 0,
									created: now(),
								})
							}
							result.push({ ...art, balance })
						}
						if (updates.length) {
							await Nfts.insertOrUpdate(updates)
						}
						if (inserts.length) {
							await Nfts.insert(inserts)
						}
					}
				}
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return result
}

export const sendCode = async (email: string, ip: string): Promise<any> => {
	try {
		await initialize()
		const time = now()
		const code = generateCode()

		const row = await Authcodes.findOne({ email })
		if (row) {
			if (row.count >= 3) return { status: 'err', msg: 'You have already failed 3 times. Please try again with a different email account.' }
			if (time - row.updated < 60) return { status: 'err', msg: `we can send a email code agian after ${60 - time + row.updated}s.` }
			await Authcodes.update(email, { code, ip, count: { $ad: 1 }, updated: time })
		} else {
			await Authcodes.insert({ email, code, ip, count: 1, updated: time })
		}
		const emailname = (email.match(/^.+(?=@)/) || [])[0]
		const contents = Html_Register.replace( /{{([^}]*)}}/g, (full: string, query: string) => {
			if (query === 'name') return emailname
			if (query === 'code') return code
			if (query === 'website') return 'http://18.191.78.153'
			if (query === 'domain') return 'crossverse'
			if (query === 'team') return 'CrossVerse Team'
			if (query === 'support') return 'support@crossverse.com'
			return full
		})
		await gmail.send(email, 'Verify your registration', contents)
		return { status: 'ok' }
	} catch (err:any) {
		setlog(err)
	}
	return { status: 'err', msg: `unknown` }
}

export const login = async ( email: string, password: string, ip: string ): Promise<any> => {
	try {
		await initialize()
		const row: any = await Users.findOne({ email })
		if (row === null) return null
		if (row.passwd === hash(password)) {
			const time = now()
			await Users.update(row.id, { lastip: ip, lastlogged: time })
			await Userlog.insert({ uid: row.id, ip, created: time })
			return { name: row.alias || '', email, id: row.id }
		}
	} catch (err:any) {
		setlog(err)
	}
	return null
}

export const register = async ( alias: string, email: string, password: string, phone: string, code: string, ip: string ): Promise<ApiResponse> => {
	try {
		await initialize()
		let row: any = await Authcodes.findOne({ email })
		if (row && row.email === email) {
			if (row.code === code) {
				row = await Users.findOne({ $or: [{ email }, { phone }] })
				if (row === null) {
					const created = now()
					const uid = await Users.insert({ alias, email, phone, passwd: hash(password), lastip: ip, created })
					updateGlobalUser({ id: uid, alias, about: '' })
					await Userlog.insert({ uid, ip, created })
					return { status: 'ok' }
				} else {
					return { status: 'err', msg: 'exists email or phone number' }
				}
			} else {
				return { status: 'err', msg: 'invalid verify code' }
			}
		} else {
			return { status: 'err', msg: 'first, you must send email verify code.' }
		}
	} catch (err:any) {
		setlog(err)
	}
	return { status: 'err', msg: `unknown` }
}

export const updateNewNFT = async ({ tokenid, store, author, worknumber, category, name, description, priceEth, balance, auction, auctiontime, physical, file, thumbnail }: CreateNFTParams): Promise<ApiResponse> => {
	try {
		await initialize()
		const { arts } = global
		const uid = global.alias[author]
		if (uid) {
			const url = 'https://storage.googleapis.com/crossverse/'
			const old = arts[tokenid]
			const isUpdate = old !== undefined
			const created = now()
			const key = hash(String(tokenid))
			const price = fromEther(priceEth)

			const v: any = {
				id: tokenid,
				key,
				store,
				uid,
				worknumber,
				category,
				name,
				description,
				price,
				auction: auction ? 1 : 0,
				auctiontime,
				physical: physical ? 1 : 0,
			}
			if (file) {
				if (isUpdate && old && old.file) await deleteFromGCP([ old.file.slice(old.file.lastIndexOf('/') + 1) ])
				const ext = file.ext
				const filename = tokenid + '-' + now() + '.' + ext
				const resUpload: any = await uploadToGCP( filename, fs.readFileSync(temp + '/upload_' + file.fileid) )
				if (!resUpload || (resUpload && resUpload.err)) return { status: 'err', msg: `Google cloud upload error` }
				v.file = filename
			}
			const thumbnailfile = file && thumbnail === null ? file : thumbnail
			if (thumbnailfile) {
				if (isUpdate && old.thumbnail) await deleteFromGCP([ old.thumbnail.slice(old.thumbnail.lastIndexOf('/') + 1) ])
				const filename = tokenid + '-thumbnail-' + now() + '.webp'
				const orgfile = temp + '/upload_' + thumbnailfile.fileid
				const tempfile = temp + '/tmp_' + thumbnailfile.fileid + '.webp'
				try {
					const dims: any = sizeOf(orgfile)
					let w = dims.width,
						h = dims.height
					const rx = dims.width / 400
					const ry = dims.height / 400
					if (rx > 1 || ry > 1) {
						if (rx > ry) {
							w = 400
							h = Math.round(h / rx)
						} else {
							w = Math.round(w / ry)
							h = 400
						}
					}
					await sharp(orgfile).resize(w, h).toFile(tempfile)
					const resUpload: any = await uploadToGCP( filename, fs.readFileSync(tempfile) )
					if (!resUpload || (resUpload && resUpload.err)) {
						return { status: 'err', msg: `Google cloud upload error`}
					}
					v.thumbnail = filename
				} catch (err:any) {
					return { status: 'err', msg: err.message }
				}
			}
			fsExtra.emptyDirSync(temp)
			if (!isUpdate) {
				v.totalsupply = balance;
				v.instock = balance;
				v.drop = 1;
				v.status = 100
				v.created = created
			}
			if (auction) {
				v.totalsupply = 1
				v.instock = 1
			}
			await Arts.insertOrUpdate(v)
			if (!isUpdate) {
				await Trades.insert({
					uid,
					tokenid,
					event: 0,
					price,
					quantity: balance,
					from: uid,
					to: 0,
					created
				})
				global.arts[tokenid] = artwork(v)
				if (tokenid > global.lastTokenId) global.lastTokenId = tokenid
			} else {
				const user = global.users[uid]
				old.store = store
				old.author = user.alias
				old.aboutAuthor = user.about
				old.worknumber = worknumber
				old.category = category
				old.title = name
				old.description = description
				old.price = toEther(price)
				old.auction = auction
				old.auctiontime = auctiontime
				if (auction) {
					old.totalsupply = 1
					old.instock = 1
				}
				if (v.file) old.file = url + v.file
				if (v.thumbnail) old.thumbnail = url + v.thumbnail
			}
			return {status: 'ok'}
		} else {
			return {status: 'err', msg: 'unknown artist'}
		}
	} catch (err:any) {
		return {status: 'err', msg: err.message}
	}
}
export const updateArtSupply = async ( tokenid: number, quantity: number ): Promise<ApiResponse> => {
	try {
		await initialize()
		const { arts } = global
		const art = arts[tokenid]
		if (art) {
			art.totalsupply += quantity
			art.instock += quantity
			await Arts.update(tokenid, { totalsupply: art.totalsupply, instock: art.instock })
			return {status: 'ok'}
		}
	} catch (err:any) {
		setlog(err)
	}
	return {status: 'err'}
}

export const updateCampaign = async ({ title, subtitle, lasttime, file }: CampaignParams): Promise<ApiResponse> => {
	try {
		await initialize()
		const data: any = {id: 1, title, subtitle, lasttime}
		if (file) {
			const row = await Campaigns.findOne(1)
			if (row && row.banner) await deleteFromGCP([row.banner.slice(row.banner.lastIndexOf('/') + 1)])
			const filename = 'campaign-' + new Date().getTime() + '.webp'
			const tempfile = temp + '/upload_' + file.fileid
			const tempfile2 = temp + '/upload_' + filename
			try {
				const dims: any = sizeOf(tempfile)
				let w = dims.width,
					h = dims.height
				const rx = dims.width / 1600
				const ry = dims.height / 625
				if (rx > 1 || ry > 1) {
					if (rx > ry) {
						w = 1600
						h = Math.round(h / rx)
					} else {
						w = Math.round(w / ry)
						h = 625
					}
				}
				await sharp(tempfile).resize(w, h).toFile(tempfile2)
				const resUpload: any = await uploadToGCP(filename, fs.readFileSync(tempfile2))
				if (!resUpload || (resUpload && resUpload.err)) {
					return { status: 'err', msg: `Google cloud upload error` }
				}
				data.banner = resUpload
			} catch (e:any) {
				setlog(e)
			}
			fsExtra.emptyDirSync(temp)
		}

		await Campaigns.insertOrUpdate(data)
		return { status: 'ok' }
	} catch (err:any) {
		setlog(err)
	}
	return { status: 'err', msg: `unknown` }
}

export const getArt = async (id: number): Promise<Artwork | null> => {
	await initialize()
	return global.arts[id] || null
}

export const getArtHolderCount = async (id: number): Promise<number> => {
	try {
		const art = await getArt(id)
		if (art) {
			return await Nfts.count('DISTINCTROW `uid`', {
				tokenid: id,
				balance: { $ne: 0 },
			})
		}
	} catch (err:any) {
		setlog(err)
	}
	return 0
}

export const setArtViews = async (uid: number, id: number): Promise<void> => {
	try {
		const art = await getArt(id)
		if (art) {
			art.views++
			await Arts.update(id, { views: art.views })
			await Artviews.insertOrUpdate({ id: getRefId(id, uid), uid })
		}
	} catch (err:any) {
		setlog(err)
	}
}

export const getArtLiked = async ( uid: number, id: number ): Promise<number> => {
	try {
		const art = await getArt(id)
		if (art) {
			const row = await Artlikes.findOne(getRefId(id, uid))
			return row===null ? 0 : row.like
		}
	} catch (err:any) {
		setlog(err)
	}
	return 0
}

export const setArtLiked = async ( uid: number, id: number, like:number ): Promise<{likes:number,dislikes:number}|number> => {
	try {
		const art = await getArt(id)
		if (art) {
			const refid = getRefId(id, uid)
			const row = await Artlikes.findOne(refid)
			if (row === null) {
				const result = await Artlikes.insert({ id: refid, uid, like })
				if (result) {
					if (like===1) {
						art.likes++
						await Arts.update(id, { likes: art.likes })
					} else {
						art.dislikes++
						await Arts.update(id, { dislikes: art.dislikes })
					}
					return {likes:art.likes,dislikes:art.dislikes}
				}
			} else {
				return row.like
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return 0
}

export const getMyTokens = async (uid: number, id: number): Promise<number> => {
	try {
		const art = await getArt(id)
		if (art) {
			const where: any = { uid }
			if (id !== 0) where.tokenid = id
			return await Nfts.sum('balance', where)
		}
	} catch (err:any) {
		setlog(err)
	}
	return 0
}

export const getOfferById = async ( txid: string ): Promise<OfferWithArt | null> => {
	try {
		await initialize()
		const { users, arts } = global
		const v: any = await Offers.findOne(txid)
		if (v) {
			const art = arts[v.tokenid]
			const user = users[v.uid]
			if (art && user) {
				return {
					ownerid:v.uid,
					txid,
					art,
					from: user.alias,
					buyer: v.buyer,
					price: toEther(v.price),
					quantity: v.quantity,
					amount: toEther(v.amount),
					status: v.status,
					created: v.created,
				}
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return null
}

const getOffers = async (
	uid: number,
	where: string | ModelWhere,
	limit: number
): Promise<Array<OfferWithArt>> => {
	const result: Array<OfferWithArt> = []
	try {
		await initialize()
		const { users, arts } = global
		const rows: any = await Offers.find(where, { created: -1 }, null, {
			limit,
		})
		if (rows) {
			for (const v of rows) {
				const art = arts[v.tokenid]
				const user = users[v.uid]
				if (art && user) {
					result.push({
						ownerid:v.uid,
						txid: v.txid,
						art,
						from: user.alias,
						buyer: v.buyer,
						price: toEther(v.price),
						quantity: v.quantity,
						amount: toEther(v.amount),
						status: v.status,
						created: v.created,
						mine: v.uid === uid,
					})
				}
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return result
}

export const getOffersByTokenId = async ( tokenid: number, uid: number ): Promise<Array<OfferWithArt>> => {
	return await getOffers(uid, { tokenid, won:0, status: 1 }, 100)
}

export const getOffersByUID = async ( uid: number ): Promise<Array<OfferWithArt>> => {
	return await getOffers(uid, { uid, won:0 }, 100)
}
export const getOffersWons = async ( uid: number ): Promise<Array<OfferWithArt>> => {
	return await getOffers(uid, { uid, won:1 }, 100)
}

export const getTradeHistory = async (
	tokenid: number
): Promise<Array<Trade>> => {
	const result: Array<Trade> = []
	try {
		await initialize()
		const { users } = global
		const rows: any = await Trades.find({ tokenid }, { created: -1 })
		if (rows) {
			for (const v of rows) {
				result.push({
					event: v.event,
					price: toEther(v.price),
					quantity: v.quantity,
					from: v.from && users[v.from] ? users[v.from].alias : null,
					to: v.to && users[v.to] ? users[v.to].alias : null,
					created: v.created,
				})
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return result
}

export const getCampaign = async (): Promise<Campaigns> => {
	try {
		await initialize()
		const row = await Campaigns.findOne({}, { id: -1 })
		return {
			title: row.title,
			subtitle: row.subtitle,
			banner: row.banner,
			lasttime: row.lasttime,
		}
	} catch (err:any) {
		setlog(err)
	}
	return {
		title: '',
		subtitle: '',
		banner: '',
		lasttime: 0,
	}
}

export const getDrops = async (): Promise<Array<Artwork>> => {
	try {
		await initialize()
		return getArts('drop')
	} catch (err:any) {
		setlog(err)
	}
	return []
}
export const getRecommended = async (): Promise<Array<Artwork>> => {
	try {
		await initialize()
		return getArts('pinned')
	} catch (err:any) {
		setlog(err)
	}
	return []
}

export const getNftList = async (): Promise<Array<Artwork>> => {
	try {
		await initialize()
		return getArts('all')
	} catch (err:any) {
		setlog(err)
	}
	return []
}

export const getNftById = async (id: number): Promise<Artwork | null> => {
	try {
		await initialize()
		const row = await Nfts.findOne(id)
		if (row) {
			const { arts, users } = global
			const v = arts[row.tokenid]
			return {
				...v,
				ownerid: row.uid,
				owner: users[row.uid].alias,
				ownerAddress: row.buyer,
				price: toEther(row.price),
				sellPrice: toEther(row.sellprice),
				balance: row.balance,
				sellBalance: row.sellbalance,
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return null
}

const getNfts = async (
	where: string | ModelWhere,
	limit: number,
	uid?: number
): Promise<Array<Artwork>> => {
	const result: Array<Artwork> = []
	try {
		await initialize()
		const rows = await (typeof where === 'string'
			? Model.exec(where)
			: Nfts.find(
				  { ...where, balance: { $ne: 0 } },
				  { created: -1 },
				  null,
				  { limit }
			  ))
		if (rows) {
			const { arts, users } = global
			for (const row of rows) {
				const v = arts[row.tokenid]
				if (v) {
					const val = {
						...v,
						owner: (users[row.uid] && users[row.uid].alias) || '',
						ownerAddress: row.buyer,
						ownerid: row.id,
						price: toEther(row.price),
						balance: row.balance || 0,
					}
					if (row.status === 100) {
						val.sellPrice = toEther(row.sellprice)
						val.sellBalance = row.sellbalance || 0
						val.listed = row.listed
					}
					if (uid) val.mine = row.uid === uid
					result.push(val)
				}
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return result
}

export const getListings = async (
	tokenid: number,
	uid: number
): Promise<Array<Artwork>> => {
	return await getNfts(
		{ tokenid, status: 100, sellbalance: { $ne: 0 } },
		100,
		uid
	)
}

export const addlist = async (
	tokenid: number,
	uid: number,
	address: string,
	price: number,
	quantity: number
): Promise<boolean> => {
	try {
		const result = await Nfts.update(
			{ uid, tokenid, buyer: address, balance: { $gt: quantity - 1 } },
			{ status: 1, sellprice: fromEther(price), sellbalance: quantity }
		)
		return result !== null
	} catch (err:any) {
		setlog(err)
	}
	return false
}

export const delist = async (uid: number): Promise<boolean> => {
	try {
		const result = await Nfts.update(
			{ uid },
			{ status: 0, sellprice: 0, sellbalance: 0, listed: 0 }
		)
		return result !== null
	} catch (err:any) {
		setlog(err)
	}
	return false
}

export const getSales = async (): Promise<Array<Artwork>> => {
	return await getNfts({ seller: null }, 20)
}

export const getResales = async (): Promise<Array<Artwork>> => {
	return await getNfts({ seller: { $ne: null } }, 20)
}

export const getPurchased = async (
	uid: number,
	limit?: number
): Promise<Array<Artwork>> => {
	return await getNfts({ uid }, limit || 100)
}

export const getLikes = async (uid: number): Promise<Array<Artwork>> => {
	return await getNfts(
		`SELECT * FROM (SELECT * FROM nfts WHERE uid='${uid}' AND balance!=0) a INNER JOIN  (SELECT (id - uid)/1e8 as tokenid FROM artlikes WHERE uid='${uid}') b USING (tokenid)`,
		20
	)
}

export const getTxs = async (uid: number): Promise<Array<Transaction>> => {
	const result: Array<Transaction> = []
	try {
		await initialize()
		const rows = await Txs.find({ uid }, { created: -1 }, null, {
			limit: 20,
		})
		if (rows) {
			for (const v of rows) {
				result.push({
					txid: v.txid,
					from: v.from,
					to: v.to,
					status: v.status,
					created: v.created,
				})
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return result
}

export const getAccount = async (uid: number): Promise<Account | null> => {
	try {
		await initialize()
		const user = await Users.findOne(uid)
		if (user) {
			const wallets = await Wallets.find({ uid })
			return {
				email: user.email,
				alias: user.alias,
				subscribe: user.subscribe === 1,
				twitter: user.twitter,
				facebook: user.facebook,
				about: user.about,
				wallets: wallets ? wallets.map((v: any) => v.key) : [],
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return null
}

export const setAccount = async (
	uid: number,
	alias: string,
	about: string,
	subscribe: boolean,
	twitter: string | null,
	facebook: string | null
): Promise<boolean> => {
	try {
		await initialize()
		if (global.users[uid]) {
			const oldAlias = global.users[uid].alias
			for (const k in global.arts) {
				const v = global.arts[k]
				if (v.author === '@' + oldAlias) {
					v.author = '@' + alias
					v.aboutAuthor = about
				}
			}
			await Users.update(uid, {
				alias,
				about,
				subscribe: subscribe ? 1 : 0,
				twitter,
				facebook,
				updated: now(),
			})
			updateGlobalUser({ ...global.users[uid], alias, about })
			return true
		}
	} catch (err:any) {
		setlog(err)
	}
	return false
}

export const setPassword = async (uid: number, oldpass: string, newpass: string): Promise<boolean> => {
	try {
		await initialize()
		if (global.users[uid]) {
			const row = await Users.findOne(uid)
			if (row && row.password === hash(oldpass)) {
				await Users.update(uid, {
					passwd: hash(newpass),
					updated: now(),
				})
				return true
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return false
}

export const setMyWallet = async ( uid: number, address: string ): Promise<string | null> => {
	try {
		await initialize()
		const isValid = web3.utils.isAddress(address)
		const { users, wallets } = global
		if (!isValid) return '❌ invalid address format'
		if (!users[uid]) return '❌ unregistered user'
		if (wallets[address] && wallets[address] !== uid) return `🦊 [${ address.slice(0, 6) + '...' + address.slice(-4) }] already in use by someone`
		await Wallets.insert({ key: address, uid })
		wallets[address] = uid
		return null
	} catch (err:any) {
		return err.message
	}
}


export const wonInAuction = async (tokenid:number): Promise<void> => {
	try {
		await initialize()
		const {arts} = global;
		const created = now()
		const art = arts[tokenid]
		if (art) {
			const won = await Offers.findOne({tokenid}, {price: -1})
			if (won) {
				const txid = await callBySigner( conf.storefront, abiStorefront, 'setAuctionWinner', tokenid, toHex(won.price * 1e12), won.quantity, toHex(won.price * won.quantity * 1e12), won.buyer )
				if (txid) await Txs.insert({ txid, uid: won.uid, from: signer, to: conf.storefront, status: 0, created })
				await Offers.update(won.id, {status:100, won:1})
			}
			await Arts.update(tokenid, {auction:0, auctiontime:0})
		}
	} catch (err:any) {
		setlog(err)
	}
}

export const checkArts = async (): Promise<void> => {
	try {
		await initialize()
		const created = now()
		if (global.lastCheckTime === 0) {
			global.lastCheckTime = created
		} else if (created - global.lastCheckTime > 600) {
			const {arts} = global;
			let rows = await Arts.find({drop: 1, auction: 1, auctiontime: {$lt: created}})
			if (rows) {
				for (const v of rows) {
					await wonInAuction(v.id)
				}
			}
			await checktxs()
			const where = {drop: 1, created: {$lt: now()}}
			rows = await Arts.find(where)
			if (rows && rows.length) {
				const updates = []
				for(let v of rows) {
					const art = arts[v.id]
					art.totalsupply -= art.instock
					art.instock = 0
					art.drop = false
					updates.push({id:v.id, totalsupply:art.totalsupply, instock:0, drop:0})
				}
				await Arts.insertOrUpdate(updates)
			}
			global.lastCheckTime = created
		}
	} catch (err:any) {
		setlog(err)
	}
}

export const admin_get_arts = async (): Promise<AdminArts> => {
	const result: AdminArts = {}
	try {
		await initialize()
		const rows = await Arts.find()
		if (rows) {
			const { users } = global
			for (const v of rows) {
				result[v.id] = {
					key: v.key,
					store: v.store,
					uid: v.uid,
					author: (users[v.uid] && users[v.uid].alias) || '-',
					worknumber: v.worknumber,
					category: v.category,
					name: v.name,
					description: v.description,
					physical: v.physical,
					price: toEther(v.price),
					auction: v.auction,
					auctiontime: v.auctiontime,
					totalsupply: v.totalsupply,
					instock: v.instock,
					volume: v.volume,
					drop: v.drop,
					pinned: v.pinned,
					created: v.created,
				}
			}
		}
	} catch (err:any) {
		setlog(err)
	}
	return result
}

export const admin_set_arts = async (data: AdminArtValue): Promise<void> => {
	try {
		await initialize()
		await Arts.insertOrUpdate({ id: data.id, [data.field]: data.value })
		if (data.field === 'drop' || data.field === 'pinned') {
			global.arts[data.id][data.field] = data.value === 1
		}
	} catch (err:any) {
		setlog(err)
	}
}
