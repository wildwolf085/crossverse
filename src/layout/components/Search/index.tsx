import React from 'react'
import { Input, InputProps } from 'antd'
import classNames from 'classnames'
import styles from './index.module.scss'

interface SearchProps extends InputProps {
  circle?: boolean
}

const prefixCls = 'search'

const Search: React.FC<SearchProps> = ({ className, ...restProps }) => {
  return (
    <Input
      className={classNames(className, styles[prefixCls], {
        [styles[`${prefixCls}-padding`]]: true,
        [styles[`${prefixCls}-group`]]: true,
      })}
      {...restProps}
      addonBefore={
        <img
          className={styles[`${prefixCls}-icon`]}
          alt="icon"
          src="/images/search.png"
        />
      }
    />
  )
}

export default Search
