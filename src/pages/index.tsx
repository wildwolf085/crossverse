import React, { useState } from 'react'
import { Row, Col, Typography } from 'antd'
import classNames from 'classnames'
/* import map from 'lodash/map' */
import ArtworkCard from '@/components/Artwork/Card'
import CarouselArtwork from '@/components/Carousel/Artwork'
import Banner from '@/components/Carousel/Banner'
import Page from '@/components/Page'
import More from '@/components/More'
import { ROW_TWO_ITEMS_XL } from '@/config'
import { getViewURL } from '@/utils/helper'
/* import mockSales from '@/mock/sales.json' */
import styles from './index.module.scss'
import {
  getRecommended,
  getSales,
  getResales,
  getETHPrice,
  checkArts,
  wonInAuction
} from '@/utils/datamodel'

const { Title } = Typography

const HomePage = (props: any) => {
  const { isDesktop, isMobile, recommends, sales, resales, ethPrice } = props
  const [dataRecommends] = useState<Array<Artwork>>(recommends)
  const [dataSales] = useState<Array<Artwork>>(sales)
  const [dataResales] = useState<Array<Artwork>>(resales)

  /* useEffect(() => setWorkItems(mockSales), []) */

/*   const renderExtra = (quantity?: number) => {
    return <div>{`${quantity}pcs`}</div>
  } */

  return (
    <Page className={styles.index}>
      <div className={styles.banner}>
        <Banner
          dots
          images={[
            {
              image: '/images/download/carousel.png',
              key: 1,
            },
            {
              image: '/images/download/carousel.png',
              key: 2,
            },
            {
              image: '/images/download/carousel.png',
              key: 3,
            },
          ]}
        />
      </div>
      <div className={styles.cardNFT}>
        <Title className={styles.titleRecommend} level={2}>
          Recommended NFT works
        </Title>
        <CarouselArtwork
          className={styles.b}
          dataSource={dataRecommends}
          isMobile={isMobile}
        />
      </div>
      <div className={styles.cardSale}>
        <Row gutter={18}>
          <Col className={styles.cardSaleRow} {...ROW_TWO_ITEMS_XL}>
            <Title className={styles.titleSale} level={2}>
              Sales record list
            </Title>
            {dataSales.map((v,k) => (
              <ArtworkCard
                key={k}
                artist={v.author}
                name={v.title}
                priceALT={v.price}
                priceFIAT={v.price * ethPrice}
                thumbnail={v.thumbnail}
                href={getViewURL(v.id)}
                /* extra={renderExtra(v.instock || 1)} */
              />
            ))}
            {isDesktop && (
              <More className={styles.more} href="/my/purchased">
                Full list
              </More>
            )}
          </Col>
          <Col {...ROW_TWO_ITEMS_XL}>
            <Title
              className={classNames(styles.titleSale, styles.titleResale)}
              level={2}
            >
              Re-sales record list
            </Title>
            {dataResales.map((v,k) => (
              <ArtworkCard
                key={k}
                artist={v.author}
                name={v.title}
                priceALT={v.price}
                priceFIAT={v.price * ethPrice}
                thumbnail={v.thumbnail}
                href={getViewURL(v.id)}
                /* extra={renderExtra(v.amount || 1)} */
              />
            ))}
            {isDesktop && (
              <More className={styles.more} href="/my/purchased">
                Full list
              </More>
            )}
          </Col>
        </Row>
      </div>
    </Page>
  )
}
export async function getServerSideProps() {
  /* await wonInAuction(100000467); */
  checkArts();
  const recommends = await getRecommended()
  const sales = await getSales()
  const resales = await getResales()
  const ethPrice = await getETHPrice()
  return {
    props: { recommends, sales, resales, ethPrice }, // will be passed to the page component as props
  }
}
export default HomePage
