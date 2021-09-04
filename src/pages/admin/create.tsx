import React from 'react'
import { Spin, Form, Row, Upload, Button, Input, Checkbox } from 'antd'

import { UploadOutlined } from '@ant-design/icons'
import Page from '@/components/Page'
import PageTitle from '@/components/Page/Title'
import styles from './create.module.scss'

import { call, getViewURL, now } from '@/utils/helper'
import Category from '@/config/category.json'
import { getAvailableTokenId, getETHPrice } from '@/utils/datamodel'

const DefaultStore = 'CrossVerse Studio'

const PAGE_NAME = 'Create a new artwork'

const PostPage = (props: any) => {
	const { availableTokenId, ethPrice } = props
	const [form] = Form.useForm()
	const [status, setStatus] = React.useState({
		loading: false,
		author: '',
		worknumber: '',
		category: 0,
		name: '',
		description: '',
		price: 1,
		auction: false,
		auctiontime: new Date((now() + 86400 * 7) *1000).toISOString().slice(0,16),
		balance: 1,
		physical: false,
		autothumbnail: true,
		fileList: [],
		thumbnail: [],
		msg: null,
		errmsg: null,
		success: false,
	})
	const refAuthor = React.useRef<Input>(null)
	const refWorknumber = React.useRef<Input>(null)
	const refCategory = React.useRef<HTMLSelectElement>(null)
	const refName = React.useRef<Input>(null)
	const refDescription = React.useRef<HTMLTextAreaElement>(null)
	const refPrice = React.useRef<Input>(null)
	const refAuctionTime = React.useRef<Input>(null)
	const refBalance = React.useRef<Input>(null)

	const changeStatus = (v: any) => setStatus({ ...status, ...v })
	const onFileChange = async (res: any) => {
		const { fileList } = res
		changeStatus({ fileList, errmsg: null })
	}
	const onThumbnailChange = async (res: any) => {
		const { fileList } = res
		changeStatus({ thumbnail:fileList, errmsg: null })
	}
	const onFinish = async () => {
		const author = status.author.trim()
		const worknumber = Number(status.worknumber) || 0
		const category = Number(status.category) || 0
		const name = status.name.trim()
		const description = status.description.trim()
		const price = Number(status.price) || 0
		const auctiontime = status.auctiontime
		const balance = Number(status.balance) || 0
		const file: any = status.fileList.length > 0 ? status.fileList[0] : null
		const thumbnail: any = status.thumbnail.length > 0 ? status.thumbnail[0] : null
		
		if (category === 0) return refCategory.current?.focus()
		if (name === '') return refName.current?.focus()
		if (description === '') return refDescription.current?.focus()
		if (price === 0) return refPrice.current?.focus()
		if (balance === 0) return refBalance.current?.focus()

		if (file === null || !file.response) {
			return changeStatus({ errmsg: 'select a file for NFT, please' })
		}

		if (thumbnail===null) {
			if (!status.autothumbnail) {
				return changeStatus({ errmsg: 'select a thumbnail image for NFT, please' })
			} else {
				const ext = file.name.slice(0,3).toLowerCase();
				const imageExts = ['jpg', 'png', 'git', 'webp'];
				if (imageExts.indexOf(ext)===-1) {
					return changeStatus({ autothumbnail: false, errmsg: 'select a thumbnail image for NFT, please' })
				}
			}
		}

		setStatus({ ...status, loading: true })
		const data = await call('/api/admin/create', {
			tokenid: availableTokenId,
			store: DefaultStore,
			author,
			worknumber,
			category,
			name,
			description,
			priceEth: price,
			auction:status.auction,
			auctiontime: Math.round(new Date(auctiontime).getTime()/1000),
			balance,
			physical: status.physical,
			file: file.response,
			thumbnail: status.autothumbnail ? null : (thumbnail ? thumbnail.response : null),
		})
		if (data) {
			if (data.status === 'ok') {
				window.open(getViewURL(availableTokenId), '_self')
			} else {
				changeStatus({ errmsg: data.msg, loading: false })
			}
		}
	}

	return (
		<Page className={styles.post} title={PAGE_NAME}>
			<Spin tip="saving..." size="large" spinning={status.loading}>
				<div className={styles.card}>
					<PageTitle className={styles.title} fontWeight="Medium">
						Publish a new NFT
					</PageTitle>
					<Row justify="center">
						<Form
							className={`${styles.form} ant-col`}
							form={form}
							style={{ flex: '1 1 auto' }}
							onFinish={onFinish}
						>
							<b>Store</b>
							<Form.Item className={styles.formItem}>
								<Input
									placeholder="Store"
									value={DefaultStore}
									disabled={true}
								/>
							</Form.Item>
							<b>Token ID</b>
							<Form.Item className={styles.formItem}>
								<Input disabled={true} value={availableTokenId} />
							</Form.Item>
							<b>Author</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'Author required',
									},
								]}
							>
								<Input
									ref={refAuthor}
									placeholder="Author"
									value={status.author || ''}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											author: e.target.value,
										})
									}
								/>
							</Form.Item>
							<b>Work Number</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'Work Number required',
									},
								]}
							>
								<Input
									ref={refWorknumber}
									placeholder="Work Number"
									type="number"
									min="0"
									max="10000"
									step="1"
									value={status.worknumber || 0}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											worknumber: e.target.value,
										})
									}
								/>
							</Form.Item>
							<b>Category</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'Category required',
									}
								]}
							>
								<select
									ref={refCategory}
									value={status.category}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											category: Number(e.target.value),
										})
									}
								>
									<option value="0">- Select category -</option>
									{Category.map((v) => v.value!==0 && (
										<option key={v.value} value={v.value}>
											{v.label}
										</option>
									))}
								</select>
							</Form.Item>
							<b>Name</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'Name required',
									},
								]}
							>
								<Input
									ref={refName}
									placeholder="Name"
									value={status.name || ''}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											name: e.target.value,
										})
									}
								/>
							</Form.Item>
							<b>Description</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'Description required',
									},
								]}
							>
								<Input.TextArea
									ref={refDescription}
									placeholder="Description"
									value={status.description || ''}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											description: e.target.value,
										})
									}
								/>
							</Form.Item>
							
							<b>Supportted Format: JPG, PNG, GIF, MP3, MP4: Less than 20MB</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'File required',
									},
								]}
							>
								<Upload
									/* listType="picture" */
									action="/api/admin/upload"
									maxCount={1}
									fileList={status.fileList}
									onChange={onFileChange}
									/* previewFile={onFilePreview} */
								>
									<Button icon={<UploadOutlined />}>Upload File</Button>
								</Upload>
							</Form.Item>

							<b>Thumbnail (supportted Format: JPG, PNG: Less than 1MB)</b>
							<div style={{marginBottom:20}}>
							<Checkbox
								checked={status.autothumbnail}
								onChange={(e) =>
									changeStatus({
										errmsg: null,
										autothumbnail: e.target.checked,
									})
								}
							>
								Automatically generate a thumbnail image.
							</Checkbox>
							</div>
							{status.autothumbnail ? null : (
								<Form.Item
									className={styles.formItem}
									rules={[
										{
											required: true,
											message: 'File required',
										},
									]}
								>
									<Upload
										listType="picture"
										action="/api/admin/upload"
										maxCount={1}
										fileList={status.thumbnail}
										onChange={onThumbnailChange}
									>
										<Button icon={<UploadOutlined />}>Upload thumbnail</Button>
									</Upload>
								</Form.Item>
							)}
							
							<div style={{marginBottom:20}}>
								<Checkbox
									checked={status.auction}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											auction: e.target.checked,
										})
									}
								>
									Highest Bid (Auction to the highest bidder)
								</Checkbox>
							</div>
							<b>{status.auction ? 'Minimum Bid' : 'Price'} (ETH)</b>
							<div style={{ display: 'flex' }}>
								<Form.Item
									className={styles.formItem}
									style={{ width: 150 }}
									rules={[
										{
											required: true,
											message: 'Price required',
										},
									]}
								>
									<Input
										ref={refPrice}
										placeholder="Price"
										type="number"
										min="0.001"
										max="1000"
										step="0.0001"
										value={status.price || ''}
										onChange={(e) =>
											changeStatus({
												errmsg: null,
												price: e.target.value,
											})
										}
									/>
								</Form.Item>
								<div style={{ padding: '8px 0 0 20px' }}>
									{status.price
										? '$ ' + (status.price * ethPrice).toFixed(2)
										: ''}
								</div>
							</div>
							
							{status.auction ? (
								<>
									<b>Expiration Date</b>
									<Form.Item
										className={styles.formItem}
										rules={[
											{
												required: true,
												message: 'Last Time required',
											},
										]}
									>
										<Input
											type="datetime-local"
											ref={refAuctionTime}
											placeholder="Last Time"
											value={status.auctiontime}
											min={new Date((now() + 86400 * 1) *1000).toISOString().slice(0,16)}
											max={new Date((now() + 86400 * 31) *1000).toISOString().slice(0,16)}
											onChange={(e) =>
												changeStatus({
													errmsg: null,
													auctiontime: e.target.value,
												})
											}
										/>
									</Form.Item>
									<div>Your auction will automatically end at this time and the highest bidder will win. No need to cancel it!</div>
								</>
							) : null}
							

							<b>in stock</b>
							<Form.Item
								className={styles.formItem}
								rules={[
									{
										required: true,
										message: 'Stock required',
									},
								]}
							>
								<Input
									ref={refBalance}
									placeholder="Maximum saleable"
									type="number"
									min="1"
									max="10000"
									step="1"
									value={status.balance || ''}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											balance: e.target.value,
										})
									}
								/>
							</Form.Item>
							<Form.Item className={styles.formItem}>
								<Checkbox
									checked={status.physical}
									onChange={(e) =>
										changeStatus({
											errmsg: null,
											physical: e.target.checked,
										})
									}
								>
									Physical
								</Checkbox>
							</Form.Item>
							<div style={{ color: 'green' }}>{status.msg}</div>
							<div style={{ color: 'red' }}>{status.errmsg}</div>
							<div className={styles.submit}>
								<Button block type="primary" htmlType="submit">
									Submit
								</Button>
							</div>
						</Form>
					</Row>
				</div>
			</Spin>
		</Page>
	)
}
export async function getServerSideProps() {
	const availableTokenId = getAvailableTokenId()
	const ethPrice = await getETHPrice()
	return {
		props: { availableTokenId, ethPrice }, // will be passed to the page component as props
	}
}
export default PostPage
