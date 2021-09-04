
declare interface AdminArt {
	key: string
	store: string
	uid: number
	author: string,
	worknumber: number
	category: number
	name: string
	description: string
	physical: boolean
	price: number
	auction: boolean
	auctiontime: string
	totalsupply: number
	instock: nubmer
	// balance: number
	volume: number
	drop: number
	pinned: number
	created: number
}
declare interface AdminArts {
	[id:number]:AdminArt
}

declare interface AdminArtValue {
	id: number
	field:string
	value:string|number
}