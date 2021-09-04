import React, { useEffect, useState } from 'react'
import { Row, Col, Table, Tooltip } from 'antd'
import classNames from 'classnames'
import map from 'lodash/map'
import ArtworkCard from '@/components/Artwork/Card'
import CarouselArtwork from '@/components/Carousel/Artwork'
import Page from '@/components/Page'
import PageTitle from '@/components/Page/Title'
import More from '@/components/More'
import { ROW_TWO_ITEMS_XL } from '@/config'
import { getOrderStatusText, ORDER_STATUS } from '@/utils/enums'
import { getViewURL } from '@/utils/helper'
/* import mockSales from '@/mock/sales.json' */
/* import mockTransactions from '@/mock/transcation.json' */
import styles from './index.module.scss'
import { getSales, getETHPrice } from '@/utils/datamodel'

const PAGE_NAME = 'My Profile'

const ProfilePage = (props: any) => {
  const { isDesktop, isMobile, sales, ethPrice } = props
  const [workItems /* , setWorkItems */] = useState<Array<Artwork>>(sales)
  const [transactionList /* , setTransactionList */] = useState<
    Array<Transaction>
  >()

  useEffect(() => {
    /* setWorkItems(mockSales) */
    /* setTransactionList(mockTransactions) */
  }, [])

  const transactionColumns = [
    {
      title: 'From',
      key: 'from',
      dataIndex: 'from',
      render: (text: string) => (
        <Tooltip title={text}>
          <div className={classNames(styles.clipAddress, 'text-truncate')}>
            {text}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'To',
      key: 'to',
      dataIndex: 'to',
      render: (text: string) => (
        <Tooltip title={text}>
          <div className={classNames(styles.clipAddress, 'text-truncate')}>
            {text}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Date',
      key: 'date',
      dataIndex: 'time',
    },
    {
      title: 'Status',
      key: 'status',
      dataIndex: 'status',
      render: (text: string) => (
        <span className={renderStatus(text)}>{text}</span>
      ),
    },
  ]

  const renderExtra = (status: number) => {
    const text = getOrderStatusText(status)

    return <div className={renderStatus(text)}>{text}</div>
  }

  const renderStatus = (type?: string) => {
    if (type === 'Completed') {
      return 'text-status-primary'
    }

    if (type === 'Cancelled') {
      return 'text-status-disabled'
    }

    if (type === 'Expired') {
      return 'text-status-disabled'
    }

    return ''
  }

  return (
    <Page className={styles.profile} title={PAGE_NAME}>
      <div className={styles.head}>
        <PageTitle
          className={classNames(styles.title, styles.paddingTitle)}
          fontWeight="Bold"
        >
          {PAGE_NAME}
        </PageTitle>
      </div>
      <div className={styles.body}>
        <div className={styles.purchased}>
          <PageTitle
            className={classNames(styles.titleWithLink, styles.titlePadding)}
            fontWeight="Bold"
          >
            <div>My Purchased NFTs</div>
            <More className={styles.titleExtra} href="/my/purchased">
              See all
            </More>
          </PageTitle>
          <CarouselArtwork
            className={styles.purchasedList}
            isMobile={isMobile}
            dataSource={map(workItems, (item) => {
              const {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                description,
                ...restProps
              } = item

              return {
                ...restProps,
              }
            })}
          />
        </div>
        <div className={styles.order}>
          <PageTitle
            className={classNames(styles.titleWithLink, styles.titlePadding)}
            fontWeight="Bold"
          >
            <div>My Orders</div>
            <More className={styles.titleExtra} href="/my/order">
              See all
            </More>
          </PageTitle>
          <Row className={styles.orderList} gutter={isDesktop ? 36 : 0}>
            <Col {...ROW_TWO_ITEMS_XL}>
              <div className={styles.subTitle}>Won Auctions</div>
              {map(workItems, (item) => (
                <ArtworkCard
                  key={item.id}
                  artist={item.author}
                  name={item.title}
                  priceALT={item.price}
                  priceFIAT={item.price * ethPrice}
                  thumbnail={item.thumbnail}
                  href={getViewURL(item.id)}
                  extra={renderExtra(ORDER_STATUS.COMPLETED)}
                />
              ))}
            </Col>
            <Col {...ROW_TWO_ITEMS_XL}>
              <div className={styles.subTitle}>Bid History</div>
              {map(workItems, (item) => (
                <ArtworkCard
                  key={item.id}
                  artist={item.author}
                  name={item.title}
                  priceALT={item.price}
                  priceFIAT={item.price * ethPrice}
                  thumbnail={item.thumbnail}
                  href={getViewURL(item.id)}
                  extra={renderExtra(ORDER_STATUS.EXPIRED)}
                />
              ))}
            </Col>
          </Row>
        </div>
        <div className={styles.transaction}>
          <PageTitle
            className={classNames(styles.titleWithLink, styles.titlePadding)}
            fontWeight="Bold"
          >
            <div>Transaction History</div>
            <More className={styles.titleExtra} href="/my/transaction">
              See all
            </More>
          </PageTitle>
          <Table
            scroll={isMobile ? { x: 1500 } : {}}
            columns={transactionColumns}
            dataSource={transactionList}
            pagination={false}
            rowKey="id"
          />
        </div>
      </div>
    </Page>
  )
}

export async function getServerSideProps() {
  const sales = await getSales()
  const ethPrice = await getETHPrice()
  return {
    props: { sales, ethPrice }, // will be passed to the page component as props
  }
}
export default ProfilePage
