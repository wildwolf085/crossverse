import React from 'react'
import { getSession } from 'next-auth/client'
import { Row, Col } from 'antd'
import classNames from 'classnames'
import ArtworkCard from '@/components/Artwork/Card'
import Page from '@/components/Page'
import PageTitle from '@/components/Page/Title'
import { ROW_TWO_ITEMS } from '@/config'
import { getViewURL } from '@/utils/helper'
import styles from './index.module.scss'
import { getOffersByUID, getETHPrice } from '@/utils/datamodel'
import { call } from '@/utils/helper'

const PAGE_TITLE = 'My Orders'

interface MyOrderProps {
	ethPrice: number
	wons: Array<OfferWithArt>
	bids: Array<OfferWithArt>
}

interface MyOrderStatus {
	checked: boolean
	wons: Array<OfferWithArt>
	bids: Array<OfferWithArt>
}

const MyOrderPage = ({wons, bids, ethPrice}: MyOrderProps) => {
	const [status, setStatus] = React.useState<MyOrderStatus>({
		checked: false,
		wons, 
		bids,
	})
	

	React.useEffect(() => {
		if (!status.checked) {
			call('/api/my/order', {}).then((res) => {
				if (res && res.status === 'ok') {
					setStatus({ ...status, checked: true, ...res.msg })
				}
			})
		}
	}, [])

	const renderStatus = () => {
		return <div>Complete</div>
	}

	return (
		<Page className={styles.order} title={PAGE_TITLE}>
			<PageTitle className={styles.title} fontWeight="Bold">
				{PAGE_TITLE}
			</PageTitle>
			<div className={classNames(styles.cardWon, styles.cardPadding)}>
				<PageTitle className={styles.subTitle} fontWeight="Medium">
					Won Auctions
				</PageTitle>
				{status.wons.length ? (
					<Row gutter={46}>
						{status.wons.map(v => (
							v.status===100 && <Col {...ROW_TWO_ITEMS} key={v.art.id}>
								<ArtworkCard
									key={v.art.id}
									artist={v.art.author}
									name={v.art.title}
									priceALT={v.art.price}
									priceFIAT={v.art.price * ethPrice}
									thumbnail={v.art.thumbnail}
									href={getViewURL(v.art.id)}
									extra={renderStatus()}
								/>
							</Col>
						))}
					</Row>
				) : (
					<div style={{ textAlign: 'center' }}>
						<img
							src="/images/empty-bids.svg"
							width={156}
							height={114}
							alt="No wons"
						/>
						<div>No wons yet</div>
					</div>
				)}
				
			</div>
			<hr style={{marginBottom:50}} />
			<div className={classNames(styles.cardBid, styles.cardPadding)}>
				<PageTitle className={styles.subTitle} fontWeight="Medium">
					Bid History
				</PageTitle>
				{status.bids.length ? (
					<Row gutter={46}>
						{status.bids.map(v => (
							v.status!==100 && <Col {...ROW_TWO_ITEMS} key={v.art.id}>
								<ArtworkCard
									key={v.art.id}
									artist={v.art.author}
									name={v.art.title}
									priceALT={v.price}
									priceFIAT={v.price * ethPrice}
									thumbnail={v.art.thumbnail}
									href={getViewURL(v.art.id)}
									extra={renderStatus()}
								/>
							</Col>
						))}
					</Row>
				) : (
					<div style={{ textAlign: 'center' }}>
						<img
							src="/images/empty-bids.svg"
							width={156}
							height={114}
							alt="No bids"
						/>
						<div>No bids yet</div>
					</div>
				)}
			</div>
		</Page>
	)
}

export async function getServerSideProps({req}:any) {
	const session: any = await getSession({ req })
	const ethPrice = await getETHPrice()
	if (session && session.user) {
		const { id } = session.user
		const rows = await getOffersByUID(id)
		const wons:Array<OfferWithArt> = [];
		const bids:Array<OfferWithArt> = [];
		for(let v of rows) {
			if (v.status===100) {
				wons.push(v)
			} else {
				bids.push(v)
			}
		}
		return { props: { wons, bids, ethPrice } }
	}
	return { props: { wons: [], bids: [], ethPrice } }
}
export default MyOrderPage
