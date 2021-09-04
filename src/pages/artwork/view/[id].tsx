import React from 'react'
import { Collapse, Image } from 'antd'
/* import Link from 'next/link' */
import { useRouter } from 'next/router'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faUserFriends,
    faUserAlt,
    faEye,
    faHeart,
    faShoppingCart,
    faPlusSquare,
    faExchangeAlt,
    IconDefinition,
} from '@fortawesome/free-solid-svg-icons'

import ArtworkCustomize from '@/components/Artwork/Customize'
import Block from '@/components/Block'
import Button from '@/components/Button'
import Page from '@/components/Page'
import Filter from './components/Filter'
import styles from './index.module.scss'
import ReactECharts from 'echarts-for-react'
import { getSession } from 'next-auth/client'
import { offsetDate, call } from '@/utils/helper'

import {
    getETHPrice,
    getArt,
    getListings,
    getOffersByTokenId,
    getTradeHistory,
    getArtHolderCount,
    setArtViews,
    getArtLiked,
    getMyTokens,
} from '@/utils/datamodel'
import CheckoutBuy from '../components/CheckoutBuy'
import CheckoutSell from '../components/CheckoutSell'
import MakeOffer from '../components/MakeOffer'
import ListSell from '../components/ListSell'

interface ViewPageProp {
    isDesktop: boolean
    logged: boolean
    art: Artwork | null
    listings: Array<Artwork>
    offers: Array<OfferWithArt>
    trades: Array<Trade>
    ethPrice: number
    hodlerCount: number
    liked: boolean
    myOwn: number
}
interface ViewPageStatus {
    showMakeOffer: boolean
    showCheckoutBuy: boolean
    showCheckoutSell: boolean
    showListSell: boolean
    showOffer: boolean
    favorited: boolean
    price: number
    likes: number
    listings: Array<Artwork>
    offers: Array<OfferWithArt>
    args: {
        id: number | string
        price: number
        quantity: number
    }
}

const { Panel } = Collapse
const PAGE_NAME = 'Detail'
const TradeAttr: {
    [event: number]: { icon: IconDefinition; label: string }
} = {
    0: {
        icon: faPlusSquare,
        label: 'Created',
    },
    1: {
        icon: faShoppingCart,
        label: 'Sale',
    },
    2: {
        icon: faExchangeAlt,
        label: 'Transfer',
    },
    3: {
        icon: faShoppingCart,
        label: 'List',
    },
}

const ViewPage = ({
    isDesktop,
    logged,
    art,
    listings,
    offers,
    trades,
    ethPrice,
    hodlerCount,
    liked,
    myOwn,
}: ViewPageProp): any => {
    const [status, setStatus] = React.useState<ViewPageStatus>({
        showMakeOffer: false,
        showCheckoutBuy: false,
        showCheckoutSell: false,
        showListSell: false,
        showOffer: false,
        favorited: liked,
        price: art?.price || 0,
        likes: 0,
        listings,
        offers,
        args: {
            id: 0,
            price: 0,
            quantity: 0,
        },
    })
    const auction = !!art?.auction && !!art?.drop
    const router = useRouter()
    const tokenid = Number(router.query.id || 0)
    const xs: any = [],
        ys: any = []
    let averagePrice = 0
    const price = art?.price || 0
    let topPrice = price
    if (status.offers.length) {
        let sum = 0
        status.offers.map((v: any) => {
            if (topPrice < v.price) topPrice = v.price
            sum += v.price
        })
        averagePrice = sum / offers.length
    }
    trades.sort((a, b) => a.created - b.created)
    trades.map((v: any) => {
        if (v.price && v.eid != 0) {
            const iOffset = 8
            const date = new Date(v.created * 1000 + 3600000 * iOffset)
            const m = date.getUTCMonth() + 1
            const d = date.getUTCDate()
            xs.push([m, d].join('/'))
            ys.push(v.price)
        }
    })
    let hasList = false
    for (const v of status.listings) {
        if (v.mine) {
            hasList = true
            break
        }
    }

    const priceChartOptions = {
        xAxis: {
            type: 'category',
            data: xs,
        },
        yAxis: {
            type: 'value',
        },
        series: [
            {
                data: ys,
                type: 'line',
                showSymbol: false,
                encode: {
                    x: 'Year',
                    y: 'Income',
                    itemName: 'Year',
                    tooltip: ['Income'],
                },
            },
        ],
    }
    const onLike = async () => {
        const res = (await call('/api/artwork/' + tokenid, {
            action: 'like',
        })) as ApiResponse
        if (res.status === 'ok') {
            setStatus({ ...status, favorited: true, likes: 1 })
        }
    }
    const onBuy = async (id: number, price: number, quantity: number) => {
        setStatus({
            ...status,
            args: { id, price, quantity },
            showCheckoutBuy: true,
        })
    }
    const onSell = async (id: string, price: number, quantity: number) => {
        setStatus({
            ...status,
            args: { id, price, quantity },
            showCheckoutSell: true,
        })
    }
    const onList = async () => {
        setStatus({ ...status, showListSell: true })
    }
    const onDelist = async () => {
        let res = (await call('/api/artwork/' + tokenid, {
            action: 'delist',
        })) as ApiResponse
        if (res.status === 'ok') {
            res = (await call('/api/artwork/' + tokenid, {
                action: 'listing',
            })) as ApiResponse
            if (res.status === 'ok') {
                setStatus({ ...status, listings: res.msg })
            }
        }
    }
    return (
        <Page className={styles.view} title={PAGE_NAME}>
            <div className={styles.wrap}>
                <div className={styles.cardDetail}>
                    <ArtworkCustomize
                        thumbnail={art?.thumbnail || ''}
                        file={art?.file || ''}
                        isVideo={!!art?.isVideo}
                        isMusic={!!art?.isMusic}
                        layout={isDesktop ? 'horizontal' : 'vertical'}
                    >
                        <div className={styles['artworkView']}>
                            <div className={styles[`artworkView-name`]}>
                                {art?.title || 'Not found'}
                            </div>
                            <div
                                style={{
                                    color: 'black',
                                    fontSize: 20,
                                    marginTop: 20,
                                }}
                            >
                                <b>{art?.author}</b>
                                <small
                                    style={{
                                        backgroundColor: '#000',
                                        color: 'white',
                                        padding: '3px 5px',
                                        marginLeft: 10,
                                    }}
                                >
                                    {art?.worknumber}
                                </small>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    marginTop: 10,
                                }}
                            >
                                <div className={styles['artworkView-item']}>
                                    <div>
                                        <FontAwesomeIcon
                                            icon={faUserFriends}
                                            style={{ marginRight: 10 }}
                                        />
                                        <span>{hodlerCount} Hodlers</span>
                                    </div>
                                </div>
                                <div className={styles['artworkView-item']}>
                                    <div>
                                        <FontAwesomeIcon
                                            icon={faUserAlt}
                                            style={{ marginRight: 10 }}
                                        />
                                        <span>You own {myOwn}</span>
                                    </div>
                                </div>

                                <div className={styles['artworkView-item']}>
                                    <div>
                                        <FontAwesomeIcon
                                            icon={faEye}
                                            style={{ marginRight: 10 }}
                                        />
                                        <span>Views {art?.views}</span>
                                    </div>
                                </div>
                                <div className={styles['artworkView-item']}>
                                    {logged && !status.favorited ? (
                                        <a onClick={onLike}>
                                            <FontAwesomeIcon
                                                icon={faHeart}
                                                style={{ marginRight: 10 }}
                                            />
                                            <span>
                                                Likes{' '}
                                                {(art?.likes || 0) +
                                                    status.likes}
                                            </span>
                                        </a>
                                    ) : (
                                        <div>
                                            <FontAwesomeIcon
                                                icon={faHeart}
                                                style={{ marginRight: 10 }}
                                            />
                                            <span>
                                                Likes{' '}
                                                {(art?.likes || 0) +
                                                    status.likes}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles[`artworkView-trade`]}>
                                {auction ? (
                                    <div
                                        className={styles[`artworkView-field`]}
                                    >
                                        Sale ends in{' '}
                                        {new Date(
                                            (art?.auctiontime || 0) * 1000
                                        ).toString()}
                                    </div>
                                ) : averagePrice ? (
                                    <>
                                        <div
                                            className={
                                                styles[`artworkView-field`]
                                            }
                                        >
                                            <div
                                                className={
                                                    styles[
                                                        `artworkView-field-label`
                                                    ]
                                                }
                                            >
                                                Trade volume
                                            </div>
                                            <div
                                                className={
                                                    styles[
                                                        `artworkView-field-value`
                                                    ]
                                                }
                                            >
                                                {Number(
                                                    (art?.volume || 0).toFixed(
                                                        6
                                                    )
                                                )}{' '}
                                                ETH
                                            </div>
                                        </div>
                                        <div
                                            className={
                                                styles[`artworkView-field`]
                                            }
                                        >
                                            <div
                                                className={
                                                    styles[
                                                        `artworkView-field-label`
                                                    ]
                                                }
                                            >
                                                Average price
                                            </div>
                                            <div
                                                className={
                                                    styles[
                                                        `artworkView-field-value`
                                                    ]
                                                }
                                            >
                                                {Number(
                                                    averagePrice.toFixed(6)
                                                )}{' '}
                                                ETH
                                            </div>
                                        </div>
                                    </>
                                ) : null}

                                <div className={styles[`artworkView-field`]}>
                                    <div
                                        className={
                                            styles[`artworkView-field-label`]
                                        }
                                    >
                                        {auction ? 'Top bid' : 'Current price'}
                                    </div>
                                    <div
                                        className={
                                            styles[`artworkView-field-value`]
                                        }
                                    >
                                        <div
                                            className={
                                                styles[`artworkView-alt`]
                                            }
                                        >
                                            <span>
                                                {Number(
                                                    auction ? topPrice : price
                                                )}{' '}
                                                ETH
                                            </span>
                                            <Image
                                                className={
                                                    styles[
                                                        `artworkView-icon-eth`
                                                    ]
                                                }
                                                alt="eth"
                                                preview={false}
                                                src="/images/eth.png"
                                            />
                                        </div>
                                        <div
                                            className={
                                                styles[`artworkView-fiat`]
                                            }
                                        >
                                            $ {(price * ethPrice).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles[`artworkView-submit`]}>
                                    {art?.instock ? (
                                        auction ? (
                                            <Button
                                                block
                                                className={
                                                    styles[
                                                        `artworkView-submit-btn`
                                                    ]
                                                }
                                                type="primary"
                                                onClick={() =>
                                                    setStatus({
                                                        ...status,
                                                        showMakeOffer: true,
                                                    })
                                                }
                                            >
                                                Place bid
                                            </Button>
                                        ) : (
                                            <Button
                                                block
                                                className={
                                                    styles[
                                                        `artworkView-submit-btn`
                                                    ]
                                                }
                                                type="primary"
                                                onClick={() =>
                                                    onBuy(
                                                        0,
                                                        art?.price || 0,
                                                        art?.instock || 0
                                                    )
                                                }
                                            >
                                                Buy Now
                                            </Button>
                                        )
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </ArtworkCustomize>
                </div>
                <div className={styles.cardAbout}>
                    <Collapse
                        defaultActiveKey={[
                            'work',
                            'artist',
                            'price',
                            'listings',
                            'offers',
                            'trade',
                        ]}
                        expandIconPosition="right"
                    >
                        <Panel header="About the work" key="work">
                            {art?.description}
                        </Panel>
                        <Panel header="About the artist" key="artist">
                            <div className={styles.artist}>
                                {/* <Image
									className={styles.avatar}
									alt={artwork.author}
									preview={false}
									src="/images/download/artist.png"
								/> */}
                                <div className={styles.about}>
                                    <div className={styles.row}>
                                        <div className={styles.name}>
                                            {art?.author}
                                        </div>
                                        <Block className={styles.num}>
                                            {art?.worknumber}
                                        </Block>
                                    </div>
                                    <div className={styles.desc}>
                                        {art?.aboutAuthor}
                                    </div>
                                </div>
                            </div>
                        </Panel>
                        {auction ? null : (
                            <Panel header="Price History" key="price">
                                {xs.length ? (
                                    <ReactECharts option={priceChartOptions} />
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        <img
                                            src="/images/no-chart-data.svg"
                                            width={207}
                                            height={101}
                                            alt="No trading"
                                        />
                                        <div>No trading data yet</div>
                                    </div>
                                )}
                            </Panel>
                        )}
                        {auction ? null : (
                            <Panel header="Listings" key="listings">
                                {status.listings.length ? (
                                    <table style={{ width: '100%' }}>
                                        <thead>
                                            <tr>
                                                <th></th>
                                                <th
                                                    style={{
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    From
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    Price
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    Quantity
                                                </th>
                                                <th
                                                    style={{
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    Created
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {status.listings.map((v) => (
                                                <tr key={v.id}>
                                                    <td>
                                                        {!art?.drop ? (
                                                            <button onClick={() => onBuy( v.ownerid || 0, v?.sellPrice || v.price, v.sellBalance || v.instock ) } >
                                                                Buy
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        {v.owner || '-'}
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {Number((v?.sellPrice || 0).toFixed(6))} WETH
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'right',
                                                        }}
                                                    >
                                                        {v.sellBalance || 0}
                                                    </td>
                                                    <td
                                                        style={{
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        {offsetDate(
                                                            v.created,
                                                            0
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div style={{ textAlign: 'center' }}>
                                        <img
                                            src="/images/empty-asks.svg"
                                            width={156}
                                            height={114}
                                            alt="empty offers"
                                        />
                                        <div>No listings</div>
                                    </div>
                                )}

                                {myOwn ? (
                                    <div className={styles.makeOffer}>
                                        {!art?.drop ? (
                                            hasList ? (
                                                <Button
                                                    onClick={onDelist}
                                                    className={styles.btn}
                                                    wrapClassName={
                                                        styles.btnWrap
                                                    }
                                                    type="primary"
                                                >
                                                    Delist my collectibles
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={onList}
                                                    className={styles.btn}
                                                    wrapClassName={
                                                        styles.btnWrap
                                                    }
                                                    type="primary"
                                                >
                                                    Sell my collectibles
                                                </Button>
                                            )
                                        ) : null}
                                    </div>
                                ) : null}
                            </Panel>
                        )}

                        <Panel header="Offers" key="offers">
                            {status.offers.length ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th></th>
                                            <th style={{ textAlign: 'left' }}>
                                                From
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                Price
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                Quantity
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                Amount
                                            </th>
                                            <th style={{ textAlign: 'center' }}>
                                                Created
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {status.offers.map((v) => (
                                            <tr key={v.art.id}>
                                                <td>
                                                    {!art?.drop ? (
                                                        <button
                                                            onClick={() =>
                                                                onSell(
                                                                    v.txid,
                                                                    v.price,
                                                                    v.quantity
                                                                )
                                                            }
                                                        >
                                                            Sell
                                                        </button>
                                                    ) : null}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'left',
                                                    }}
                                                >
                                                    {v.from || '-'}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {Number(v.price.toFixed(6))}{' '}
                                                    WETH
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {v.quantity}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {Number(
                                                        v.amount.toFixed(6)
                                                    )}{' '}
                                                    WETH
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    {offsetDate(v.created, 0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <img
                                        src="/images/empty-bids.svg"
                                        width={156}
                                        height={114}
                                        alt="empty offers"
                                    />
                                    <div>No offers yet</div>
                                </div>
                            )}
                            {!art?.drop ? (
                                <div className={styles.makeOffer}>
                                    <Button
                                        onClick={() =>
                                            setStatus({
                                                ...status,
                                                showMakeOffer: true,
                                            })
                                        }
                                        className={styles.btn}
                                        wrapClassName={styles.btnWrap}
                                        type="primary"
                                    >
                                        Make an offer
                                    </Button>
                                </div>
                            ) : null}
                        </Panel>
                        <Panel header="Trade History" key="trade">
                            <Filter onChange={() => console.log()} />
                            {trades.length ? (
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'left' }}>
                                                Event
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                Price
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                Quantity
                                            </th>
                                            <th style={{ textAlign: 'center' }}>
                                                From
                                            </th>
                                            <th style={{ textAlign: 'center' }}>
                                                To
                                            </th>
                                            <th style={{ textAlign: 'center' }}>
                                                Created
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trades.map((v) => (
                                            <tr key={v.created}>
                                                <td>
                                                    <FontAwesomeIcon
                                                        icon={
                                                            TradeAttr[v.event]
                                                                .icon
                                                        }
                                                        style={{
                                                            marginRight: 10,
                                                        }}
                                                    />
                                                    {TradeAttr[v.event].label}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {Number(v.price.toFixed(6))}{' '}
                                                    WETH
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'right',
                                                    }}
                                                >
                                                    {v.quantity}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    {v.from || '-'}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    {v.to || '-'}
                                                </td>
                                                <td
                                                    style={{
                                                        textAlign: 'center',
                                                    }}
                                                >
                                                    {offsetDate(v.created, 0)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <img
                                        src="/images/empty-bids.svg"
                                        width={156}
                                        height={114}
                                        alt="empty offers"
                                    />
                                    <div>No trading data yet</div>
                                </div>
                            )}
                        </Panel>
                    </Collapse>
                </div>
            </div>
            {art !== null ? (
                <CheckoutBuy
                    visible={status.showCheckoutBuy}
                    onClose={() =>
                        setStatus({ ...status, showCheckoutBuy: false })
                    }
                    art={art}
                    args={status.args}
                    ethPrice={ethPrice}
                />
            ) : null}
            {art !== null ? (
                <MakeOffer
                    visible={status.showMakeOffer}
                    onClose={() =>
                        setStatus({ ...status, showMakeOffer: false })
                    }
                    onUpdate={(data) =>
                        setStatus({
                            ...status,
                            offers: data,
                            showMakeOffer: false,
                        })
                    }
                    art={{ ...art, price: auction ? topPrice : status.price }}
                    ethPrice={ethPrice}
                />
            ) : null}
            {art !== null ? (
                <ListSell
                    visible={status.showListSell}
                    onClose={() =>
                        setStatus({ ...status, showListSell: false })
                    }
                    onUpdate={(data) =>
                        setStatus({
                            ...status,
                            listings: data,
                            showListSell: false,
                        })
                    }
                    art={{ ...art }}
                    balance={myOwn}
                    ethPrice={ethPrice}
                />
            ) : null}
            {art !== null ? (
                <CheckoutSell
                    visible={status.showCheckoutSell}
                    onClose={() =>
                        setStatus({ ...status, showCheckoutSell: false })
                    }
                    onUpdate={(data) =>
                        setStatus({
                            ...status,
                            offers: data,
                            showCheckoutSell: false,
                        })
                    }
                    art={{ ...art }}
                    args={status.args}
                    ethPrice={ethPrice}
                />
            ) : null}
        </Page>
    )
}

export const getServerSideProps = async ({ req, query }: any): Promise<any> => {
    const tokenid = Number(query.id) || 0
    const session: any = await getSession({ req })
    const ethPrice: number = await getETHPrice()
    const art: Artwork | null = await getArt(tokenid)
    const trades: Array<Trade> = art !== null ? await getTradeHistory(tokenid) : []
    const hodlerCount: number = art !== null ? await getArtHolderCount(tokenid) : 0

    let logged = false,
        liked = false,
        myOwn = 0,
        uid = 0
    if (session && session.user) {
        const { id } = session.user
        uid = id
        logged = true
        liked = await getArtLiked(id, tokenid)
        myOwn = await getMyTokens(id, tokenid)
        await setArtViews(id, tokenid)
    }
    const offers = art !== null ? await getOffersByTokenId(tokenid, uid) : []
    const listings: Array<Artwork> = art !== null ? await getListings(tokenid, uid) : []
    return {
        props: {
            logged,
            art,
            listings,
            offers,
            trades,
            ethPrice,
            hodlerCount,
            liked,
            myOwn,
        },
    }
}
export default ViewPage
